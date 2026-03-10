"use client";

import { useState, useRef, useEffect, useCallback, useMemo, type ReactElement } from "react";
import * as d3Hierarchy from "d3-hierarchy";
import type { Person, FamilyTree as FamilyTreeData } from "@/lib/family";

// ── Constants ──────────────────────────────────────────────
const CARD_W = 220;
const CARD_H = 100;
const COUPLE_GAP = 8; // gap between spouse cards
const COUPLE_W = CARD_W * 2 + COUPLE_GAP; // width of a couple unit
const H_SPACING = 40; // minimum horizontal gap between sibling branches
const V_SPACING = 120; // vertical gap between generations
const NODE_SIZE_X = COUPLE_W + H_SPACING; // horizontal node size for d3.tree
const NODE_SIZE_Y = CARD_H + V_SPACING; // vertical node size for d3.tree

// ── Types ──────────────────────────────────────────────────
interface TreeNode {
  id: string;
  person: Person;
  spouse?: Person;
  children: TreeNode[];
}

interface LayoutNode {
  id: string;
  person: Person;
  spouse?: Person;
  x: number;
  y: number;
  children: LayoutNode[];
  parent: LayoutNode | null;
}

interface FamilyTreeProps {
  family: FamilyTreeData;
}

// ── Data transformation ────────────────────────────────────
// Build a proper tree from the flat family data.
// Strategy: find all people who have children via parentId.
// A "tree node" is a person who is a parentId target (i.e. has kids).
// Their spouse is rendered beside them but is NOT a separate tree node.
// People who have no children are leaf nodes under their parent.

function buildTreeRoots(family: FamilyTreeData): TreeNode[] {
  const people = family.people;

  // Build a map of parentId -> children (only people who have a parentId)
  const childrenOf = new Map<string, Person[]>();
  for (const p of Object.values(people)) {
    if (p.parentId) {
      const existing = childrenOf.get(p.parentId) || [];
      existing.push(p);
      childrenOf.set(p.parentId, existing);
    }
  }

  // Determine who is a "primary" person (listed as parentId by someone,
  // OR is a root person). Spouses who are only referenced via spouseId
  // (and never as parentId) will be attached to their partner's node.
  const isParent = new Set(childrenOf.keys());

  // Find the spouse of a person
  const getSpouse = (p: Person): Person | undefined => {
    if (p.spouseId) return people[p.spouseId];
    return undefined;
  };

  // Recursively build tree nodes
  const visited = new Set<string>();

  function buildNode(personId: string): TreeNode | null {
    if (visited.has(personId)) return null;
    const person = people[personId];
    if (!person) return null;

    visited.add(personId);

    const spouse = getSpouse(person);
    if (spouse) visited.add(spouse.id);

    // Get children of this person. Also check if their spouse is a parentId target.
    const myChildren = childrenOf.get(personId) || [];
    const spouseChildren = spouse ? (childrenOf.get(spouse.id) || []) : [];

    // Merge and deduplicate
    const allChildIds = new Set<string>();
    const allChildren: Person[] = [];
    for (const c of [...myChildren, ...spouseChildren]) {
      if (!allChildIds.has(c.id)) {
        allChildIds.add(c.id);
        allChildren.push(c);
      }
    }

    // For each child, if they are a "primary" person (have kids of their own),
    // build a sub-tree. If they are spouses only (no children, referenced
    // only via spouseId), they'll be paired with their partner.
    // But first: children who are themselves parents become tree nodes.
    // Children who are leaf nodes (no children of their own) also become tree nodes,
    // but their spouses are attached beside them.

    const childNodes: TreeNode[] = [];
    for (const child of allChildren) {
      // Skip if child is already visited (e.g. they were a spouse we already handled)
      if (visited.has(child.id)) continue;

      const node = buildNode(child.id);
      if (node) childNodes.push(node);
    }

    return {
      id: personId,
      person,
      spouse,
      children: childNodes,
    };
  }

  // Find root ancestors: people who have no parentId and are either
  // themselves a parentId target or have a spouse who is.
  // We need to identify top-level roots (generation 2 = great-grandparents, etc.)
  const rootCandidates: string[] = [];
  for (const p of Object.values(people)) {
    if (!p.parentId && !visited.has(p.id)) {
      // Is this person a parent, or is their spouse a parent?
      const spouse = getSpouse(p);
      const isAParent = isParent.has(p.id) || (spouse && isParent.has(spouse.id));
      if (isAParent) {
        rootCandidates.push(p.id);
      }
    }
  }

  // Sort by generation descending (highest generation = oldest ancestor at top)
  rootCandidates.sort((a, b) => (people[b].generation ?? 0) - (people[a].generation ?? 0));

  const roots: TreeNode[] = [];
  for (const id of rootCandidates) {
    if (visited.has(id)) continue;
    const node = buildNode(id);
    if (node) roots.push(node);
  }

  // Also pick up any remaining unvisited people who have a parentId
  // pointing to someone already visited (edge case: spouse-only references)
  // This handles people who are leaf nodes and weren't picked up
  for (const p of Object.values(people)) {
    if (!visited.has(p.id)) {
      // This person wasn't reached. They may be an orphan spouse.
      // We skip them since they'll be rendered as a spouse on their partner's card.
    }
  }

  return roots;
}

// If there are multiple roots, create a virtual root to unify them
function unifyRoots(roots: TreeNode[]): TreeNode {
  if (roots.length === 1) return roots[0];

  // Create a virtual root
  const virtualPerson: Person = {
    id: "__root__",
    firstName: "",
    lastName: "",
    generation: Math.max(...roots.map(r => r.person.generation)) + 1,
  };

  return {
    id: "__root__",
    person: virtualPerson,
    children: roots,
  };
}

// ── Layout computation using d3.tree() ─────────────────────
function computeLayout(root: TreeNode): LayoutNode {
  // Convert our TreeNode into a d3 hierarchy
  const hierarchy = d3Hierarchy.hierarchy(root, (d) => d.children);

  // Create a tree layout with fixed node sizes
  const treeLayout = d3Hierarchy.tree<TreeNode>()
    .nodeSize([NODE_SIZE_X, NODE_SIZE_Y])
    .separation((a, b) => {
      // If siblings, use 1. If cousins, use 1.2 for more breathing room.
      return a.parent === b.parent ? 1 : 1.2;
    });

  const laid = treeLayout(hierarchy);

  // Convert d3 hierarchy nodes to our LayoutNode format
  function convert(node: d3Hierarchy.HierarchyPointNode<TreeNode>): LayoutNode {
    return {
      id: node.data.id,
      person: node.data.person,
      spouse: node.data.spouse,
      x: node.x,
      y: node.y,
      children: (node.children || []).map(convert),
      parent: null, // will be set below
    };
  }

  const layoutRoot = convert(laid);

  // Set parent references
  function setParents(node: LayoutNode) {
    for (const child of node.children) {
      child.parent = node;
      setParents(child);
    }
  }
  setParents(layoutRoot);

  return layoutRoot;
}

// ── Flatten layout tree for rendering ──────────────────────
function flattenLayout(node: LayoutNode): LayoutNode[] {
  const result: LayoutNode[] = [];
  function walk(n: LayoutNode) {
    result.push(n);
    for (const c of n.children) walk(c);
  }
  walk(node);
  return result;
}

// ── PersonCard component ───────────────────────────────────
function PersonCard({
  person,
  isHighlighted,
}: {
  person: Person;
  isHighlighted?: boolean;
}) {
  const initials = person.lastName
    ? `${person.firstName[0]}${person.lastName[0]}`
    : person.firstName[0] || "?";

  const birthYear = person.birthDate
    ? new Date(person.birthDate).getFullYear()
    : null;
  const deathYear = person.deathDate
    ? new Date(person.deathDate).getFullYear()
    : null;

  const dateStr = birthYear
    ? deathYear
      ? `${birthYear} - ${deathYear}`
      : `b. ${birthYear}`
    : "";

  return (
    <div
      className={`ft-card ${person.isYou ? "ft-card--you" : ""} ${isHighlighted ? "ft-card--highlight" : ""}`}
    >
      <div className="ft-card__avatar">{initials}</div>
      <div className="ft-card__info">
        <div className="ft-card__name">
          {person.firstName} {person.lastName}
        </div>
        {dateStr && <div className="ft-card__dates">{dateStr}</div>}
      </div>
    </div>
  );
}

// ── SVG Connectors ─────────────────────────────────────────
function ConnectorLines({ nodes }: { nodes: LayoutNode[] }) {
  const paths: ReactElement[] = [];

  for (const node of nodes) {
    if (node.children.length === 0) continue;
    if (node.id === "__root__") {
      // Virtual root: don't draw lines from it, draw from each child
      continue;
    }

    const parentX = node.x;
    const parentBottomY = node.y + CARD_H / 2;

    // Midpoint Y between parent bottom and children top
    const firstChild = node.children[0];
    const childTopY = firstChild.y - CARD_H / 2;
    const midY = parentBottomY + (childTopY - parentBottomY) / 2;

    // Vertical line from parent down to midpoint
    paths.push(
      <line
        key={`v-down-${node.id}`}
        x1={parentX}
        y1={parentBottomY}
        x2={parentX}
        y2={midY}
        className="ft-connector"
      />
    );

    if (node.children.length === 1) {
      // Single child: straight line down
      const child = node.children[0];
      paths.push(
        <line
          key={`v-child-${child.id}`}
          x1={parentX}
          y1={midY}
          x2={child.x}
          y2={child.y - CARD_H / 2}
          className="ft-connector"
        />
      );
    } else {
      // Multiple children: horizontal bar + vertical drops
      const childXs = node.children.map((c) => c.x);
      const minX = Math.min(...childXs);
      const maxX = Math.max(...childXs);

      // Horizontal bar
      paths.push(
        <line
          key={`h-bar-${node.id}`}
          x1={minX}
          y1={midY}
          x2={maxX}
          y2={midY}
          className="ft-connector"
        />
      );

      // Vertical drops to each child
      for (const child of node.children) {
        paths.push(
          <line
            key={`v-child-${child.id}`}
            x1={child.x}
            y1={midY}
            x2={child.x}
            y2={child.y - CARD_H / 2}
            className="ft-connector"
          />
        );
      }
    }

    // Spouse connector (dashed horizontal line between spouse cards)
    if (node.spouse) {
      const leftX = node.x - COUPLE_GAP / 2 - CARD_W;
      const rightX = node.x - COUPLE_GAP / 2;
      const leftEnd = leftX + CARD_W;
      const rightStart = rightX;
      // Actually the spouse cards sit at:
      // person card: centerX = node.x - (CARD_W + COUPLE_GAP) / 2
      // spouse card: centerX = node.x + (CARD_W + COUPLE_GAP) / 2
      // So the right edge of person card = node.x - COUPLE_GAP/2
      // And the left edge of spouse card = node.x + COUPLE_GAP/2
      paths.push(
        <line
          key={`spouse-${node.id}`}
          x1={node.x - COUPLE_GAP / 2}
          y1={node.y}
          x2={node.x + COUPLE_GAP / 2}
          y2={node.y}
          className="ft-connector ft-connector--spouse"
        />
      );
    }
  }

  return <>{paths}</>;
}

// ── Virtual root connector (just horizontal bars for multi-root) ───
function VirtualRootConnectors({ root }: { root: LayoutNode }) {
  if (root.id !== "__root__") return null;
  // No lines from virtual root
  return null;
}

// ── Main component ─────────────────────────────────────────
export default function FamilyTree({ family }: FamilyTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  const [initialized, setInitialized] = useState(false);

  // Build and layout the tree
  const layoutRoot = useMemo(() => {
    const roots = buildTreeRoots(family);
    const unified = unifyRoots(roots);
    return computeLayout(unified);
  }, [family]);

  const allNodes = useMemo(() => flattenLayout(layoutRoot), [layoutRoot]);

  // Filter out virtual root from rendering
  const renderNodes = useMemo(
    () => allNodes.filter((n) => n.id !== "__root__"),
    [allNodes]
  );

  // Center the tree on the "You" person or the root
  useEffect(() => {
    if (!containerRef.current || initialized) return;

    const youNode = renderNodes.find((n) => n.person.isYou);
    const centerNode = youNode || renderNodes[0];
    if (!centerNode) return;

    const rect = containerRef.current.getBoundingClientRect();
    setTransform({
      x: rect.width / 2 - centerNode.x,
      y: rect.height / 2 - centerNode.y,
      scale: 0.85,
    });
    setInitialized(true);
  }, [renderNodes, initialized]);

  // ── Pan handlers ──────────────────────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Only pan on primary button (left click) or touch
    if (e.button !== 0) return;
    setIsPanning(true);
    lastPointer.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isPanning) return;
      const dx = e.clientX - lastPointer.current.x;
      const dy = e.clientY - lastPointer.current.y;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      setTransform((t) => ({ ...t, x: t.x + dx, y: t.y + dy }));
    },
    [isPanning]
  );

  const handlePointerUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // ── Zoom handler ──────────────────────────────────────
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    setTransform((t) => {
      const newScale = Math.min(Math.max(t.scale * factor, 0.15), 3);

      // Zoom towards cursor position
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { ...t, scale: newScale };

      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;

      const scaleRatio = newScale / t.scale;
      return {
        scale: newScale,
        x: cx - scaleRatio * (cx - t.x),
        y: cy - scaleRatio * (cy - t.y),
      };
    });
  }, []);

  // ── Zoom controls ─────────────────────────────────────
  const zoomIn = () =>
    setTransform((t) => ({ ...t, scale: Math.min(t.scale * 1.25, 3) }));
  const zoomOut = () =>
    setTransform((t) => ({ ...t, scale: Math.max(t.scale * 0.8, 0.15) }));
  const resetView = () => {
    const youNode = renderNodes.find((n) => n.person.isYou);
    const centerNode = youNode || renderNodes[0];
    if (!centerNode || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setTransform({
      x: rect.width / 2 - centerNode.x,
      y: rect.height / 2 - centerNode.y,
      scale: 0.85,
    });
  };

  // Compute SVG viewBox bounds for the full tree
  const bounds = useMemo(() => {
    if (renderNodes.length === 0) return { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of renderNodes) {
      const halfCoupleW = n.spouse ? COUPLE_W / 2 : CARD_W / 2;
      minX = Math.min(minX, n.x - halfCoupleW - 20);
      maxX = Math.max(maxX, n.x + halfCoupleW + 20);
      minY = Math.min(minY, n.y - CARD_H / 2 - 20);
      maxY = Math.max(maxY, n.y + CARD_H / 2 + 20);
    }
    return { minX, minY, maxX, maxY };
  }, [renderNodes]);

  const svgWidth = bounds.maxX - bounds.minX;
  const svgHeight = bounds.maxY - bounds.minY;

  return (
    <div
      ref={containerRef}
      className="ft-canvas"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onWheel={handleWheel}
      style={{ cursor: isPanning ? "grabbing" : "grab" }}
    >
      {/* Zoom controls */}
      <div className="ft-controls">
        <button onClick={zoomIn} className="ft-controls__btn" title="Zoom in">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 3v12M3 9h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <button onClick={zoomOut} className="ft-controls__btn" title="Zoom out">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M3 9h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <button onClick={resetView} className="ft-controls__btn ft-controls__btn--text" title="Reset view">
          Reset
        </button>
      </div>

      {/* Hint */}
      <div className="ft-hint">Scroll to zoom &middot; Drag to pan</div>

      {/* Tree content (SVG + HTML cards in same transform group) */}
      <div
        className="ft-world"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: "0 0",
        }}
      >
        {/* SVG layer for connector lines */}
        <svg
          className="ft-svg"
          style={{
            position: "absolute",
            left: bounds.minX,
            top: bounds.minY,
            width: svgWidth,
            height: svgHeight,
            overflow: "visible",
          }}
          viewBox={`${bounds.minX} ${bounds.minY} ${svgWidth} ${svgHeight}`}
        >
          <ConnectorLines nodes={allNodes} />
          <VirtualRootConnectors root={layoutRoot} />
        </svg>

        {/* HTML layer for person cards */}
        {renderNodes.map((node) => {
          const hasSpouse = !!node.spouse;

          // Position: if couple, offset both cards from center
          const personX = hasSpouse
            ? node.x - (CARD_W + COUPLE_GAP) / 2
            : node.x - CARD_W / 2;
          const personY = node.y - CARD_H / 2;

          return (
            <div key={node.id} className="ft-node-group" style={{ position: "absolute" }}>
              {/* Primary person card */}
              <div
                className="ft-node"
                style={{
                  left: personX,
                  top: personY,
                  width: CARD_W,
                  height: CARD_H,
                }}
              >
                <PersonCard person={node.person} />
              </div>

              {/* Spouse card */}
              {node.spouse && (
                <div
                  className="ft-node"
                  style={{
                    left: node.x + COUPLE_GAP / 2,
                    top: personY,
                    width: CARD_W,
                    height: CARD_H,
                  }}
                >
                  <PersonCard person={node.spouse} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
