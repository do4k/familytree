"use client";

import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import type { Person, FamilyTree } from "@/lib/family";
import { hierarchy, tree, type HierarchyPointNode } from "d3-hierarchy";
import { linkVertical, type Link } from "d3-shape";

interface FamilyTreeProps {
  family: FamilyTree;
}

interface Position {
  x: number;
  y: number;
}

interface TreeNodeData {
  id: string;
  person: Person;
  children?: TreeNodeData[];
}

function getSpouse(person: Person, family: FamilyTree): Person | undefined {
  if (!person.spouseId) return undefined;
  return family.people[person.spouseId];
}

function getChildren(person: Person, family: FamilyTree): Person[] {
  return Object.values(family.people).filter((p) => p.parentId === person.id);
}

function getSiblings(person: Person, family: FamilyTree): Person[] {
  if (!person.parentId) return [];
  return Object.values(family.people).filter(
    (p) => p.parentId === person.parentId && p.id !== person.id
  );
}

function getParents(person: Person, family: FamilyTree): Person[] {
  const parents: Person[] = [];
  if (person.parentId) {
    const parent = family.people[person.parentId];
    if (parent) {
      parents.push(parent);
      const spouse = getSpouse(parent, family);
      if (spouse) parents.push(spouse);
    }
  }
  return parents;
}

function PersonCard({ person, onClick, isSelected }: { person: Person; onClick: () => void; isSelected: boolean }) {
  const initials = person.lastName 
    ? `${person.firstName[0]}${person.lastName[0]}` 
    : person.firstName[0];
  const birthYear = person.birthDate ? new Date(person.birthDate).getFullYear() : "";
  const deathYear = person.deathDate ? new Date(person.deathDate).getFullYear() : "";

  return (
    <div
      className={`tree-person ${person.isYou ? "is-you" : ""} ${isSelected ? "selected" : ""}`}
      onClick={onClick}
    >
      <div className="tree-avatar">{initials}</div>
      <div className="tree-name">{person.firstName} {person.lastName}</div>
      <div className="tree-dates">
        {birthYear} {deathYear ? `— ${deathYear}` : ""}
      </div>
    </div>
  );
}

function buildTreeData(rootPerson: Person, family: FamilyTree): TreeNodeData {
  const visited = new Set<string>();
  
  function buildNode(person: Person): TreeNodeData {
    if (visited.has(person.id)) {
      return { id: person.id + "_copy", person };
    }
    visited.add(person.id);
    
    const children = getChildren(person, family);
    const childNodes = children
      .filter(c => !visited.has(c.id))
      .map(c => buildNode(c));
    
    return {
      id: person.id,
      person,
      children: childNodes.length > 0 ? childNodes : undefined
    };
  }
  
  return buildNode(rootPerson);
}

function calculateTreeLayout(root: Person, family: FamilyTree): Map<string, Position> {
  const positions = new Map<string, Position>();
  
  const treeData = buildTreeData(root, family);
  const rootNode = hierarchy(treeData);
  
  const treeLayout = tree<TreeNodeData>()
    .nodeSize([260, 160])
    .separation((a, b) => (a.parent === b.parent ? 1 : 1.2));
  
  const treeRoot = treeLayout(rootNode);
  
  const nodeWidth = 220;
  const nodeHeight = 100;
  
  treeRoot.each((node: HierarchyPointNode<TreeNodeData>) => {
    positions.set(node.data.id, {
      x: node.x,
      y: node.y
    });
  });
  
  const spouse = getSpouse(root, family);
  if (spouse && !positions.has(spouse.id)) {
    const rootPos = positions.get(root.id);
    if (rootPos) {
      positions.set(spouse.id, {
        x: rootPos.x + nodeWidth + 40,
        y: rootPos.y
      });
    }
  }
  
  const siblings = getSiblings(root, family);
  siblings.forEach(sibling => {
    if (!positions.has(sibling.id)) {
      const siblingPos = positions.get(root.id);
      if (siblingPos) {
        positions.set(sibling.id, {
          x: siblingPos.x,
          y: siblingPos.y
        });
      }
      const siblingSpouse = getSpouse(sibling, family);
      if (siblingSpouse && !positions.has(siblingSpouse.id)) {
        const sPos = positions.get(sibling.id);
        if (sPos) {
          positions.set(siblingSpouse.id, {
            x: sPos.x + nodeWidth + 40,
            y: sPos.y
          });
        }
      }
    }
  });
  
  const parents = getParents(root, family);
  parents.forEach(parent => {
    if (!positions.has(parent.id)) {
      const parentPos = positions.get(root.id);
      if (parentPos) {
        positions.set(parent.id, {
          x: parentPos.x,
          y: parentPos.y - 160
        });
      }
      const parentSpouse = getSpouse(parent, family);
      if (parentSpouse && !positions.has(parentSpouse.id)) {
        const pPos = positions.get(parent.id);
        if (pPos) {
          positions.set(parentSpouse.id, {
            x: pPos.x + nodeWidth + 40,
            y: pPos.y
          });
        }
      }
    }
  });
  
  return positions;
}

function ViewSelector({ onBack }: { onBack: () => void }) {
  return (
    <button 
      onClick={onBack}
      className="btn btn-secondary"
      style={{ 
        position: "fixed", 
        top: "20px", 
        left: "20px", 
        zIndex: 100,
        padding: "8px 16px", 
        fontSize: "14px" 
      }}
    >
      ← Back to My Tree
    </button>
  );
}

export default function FamilyTree({ family }: FamilyTreeProps) {
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const root = selectedPerson || family.people[family.rootId];
  const positions = calculateTreeLayout(root, family);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(s => Math.min(Math.max(s * delta, 0.3), 3));
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener("wheel", handleWheel, { passive: false });
      return () => container.removeEventListener("wheel", handleWheel);
    }
  }, [handleWheel]);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    setOffset(o => ({
      x: o.x + e.clientX - lastPos.current.x,
      y: o.y + e.clientY - lastPos.current.y
    }));
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const renderLines = (): ReactNode[] => {
    const lines: ReactNode[] = [];
    const nodeWidth = 220;
    const nodeHeight = 100;

    const treeData = buildTreeData(root, family);
    const rootNode = hierarchy(treeData);
    const treeLayout = tree<TreeNodeData>()
      .nodeSize([260, 160])
      .separation((a, b) => (a.parent === b.parent ? 1 : 1.2));
    const treeRoot = treeLayout(rootNode);

    const createLink = linkVertical<HierarchyPointNode<TreeNodeData>, HierarchyPointNode<TreeNodeData>>()
      .x(d => d.x)
      .y(d => d.y);

    treeRoot.links().forEach((link, idx) => {
      const sourcePos = positions.get(link.source.data.id);
      const targetPos = positions.get(link.target.data.id);
      
      if (sourcePos && targetPos) {
        const adjustedSource = { x: sourcePos.x, y: sourcePos.y + nodeHeight / 2 };
        const adjustedTarget = { x: targetPos.x, y: targetPos.y - nodeHeight / 2 };
        
        lines.push(
          <path
            key={`line-${link.source.data.id}-${link.target.data.id}`}
            d={createLink({ source: adjustedSource, target: adjustedTarget } as any) || ""}
            className="tree-connection-line"
          />
        );
      }
    });

    const parents = getParents(root, family);
    parents.forEach(parent => {
      const parentPos = positions.get(parent.id);
      const rootPos = positions.get(root.id);
      if (parentPos && rootPos) {
        lines.push(
          <path
            key={`line-${parent.id}`}
            d={`M ${parentPos.x} ${parentPos.y + nodeHeight / 2} 
                L ${parentPos.x} ${parentPos.y + nodeHeight / 2 + 35} 
                L ${rootPos.x} ${parentPos.y + nodeHeight / 2 + 35} 
                L ${rootPos.x} ${rootPos.y - nodeHeight / 2}`}
            className="tree-connection-line"
          />
        );
      }
    });

    const spouse = getSpouse(root, family);
    if (spouse) {
      const spousePos = positions.get(spouse.id);
      const rootPos = positions.get(root.id);
      if (spousePos && rootPos) {
        lines.push(
          <line
            key={`line-spouse`}
            x1={rootPos.x + nodeWidth / 2}
            y1={spousePos.y}
            x2={spousePos.x - nodeWidth / 2}
            y2={spousePos.y}
            className="tree-connection-line"
            style={{ strokeDasharray: "5,5" }}
          />
        );
      }
    }

    const children = getChildren(root, family);
    children.forEach(child => {
      const childPos = positions.get(child.id);
      const rootPos = positions.get(root.id);
      if (childPos && rootPos) {
        lines.push(
          <path
            key={`line-child-${child.id}`}
            d={`M ${rootPos.x} ${rootPos.y + nodeHeight / 2} 
                L ${rootPos.x} ${rootPos.y + nodeHeight / 2 + 35} 
                L ${childPos.x} ${rootPos.y + nodeHeight / 2 + 35} 
                L ${childPos.x} ${childPos.y - nodeHeight / 2}`}
            className="tree-connection-line"
          />
        );
      }
    });

    return lines;
  };

  return (
    <div 
      ref={containerRef}
      style={{ 
        width: "100vw", 
        height: "100vh", 
        overflow: "hidden",
        cursor: isDragging.current ? "grabbing" : "grab",
        background: "var(--background)",
        position: "relative",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {selectedPerson && (
        <ViewSelector onBack={() => setSelectedPerson(null)} />
      )}
      
      <div style={{ 
        position: "absolute",
        top: "20px",
        right: "20px",
        zIndex: 100,
        display: "flex",
        gap: "8px",
      }}>
        <button 
          onClick={() => setScale(s => Math.min(s * 1.2, 3))}
          className="btn btn-secondary"
          style={{ padding: "8px 12px", fontSize: "14px" }}
        >
          +
        </button>
        <button 
          onClick={() => setScale(s => Math.max(s * 0.8, 0.3))}
          className="btn btn-secondary"
          style={{ padding: "8px 12px", fontSize: "14px" }}
        >
          −
        </button>
      </div>

      <div style={{ 
        position: "absolute",
        bottom: "20px",
        left: "20px",
        zIndex: 100,
        fontSize: "12px",
        color: "var(--pie-secondary-light)",
      }}>
        Scroll to zoom • Drag to pan
      </div>

      <svg
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        <g transform={`translate(${offset.x}, ${offset.y}) scale(${scale})`}>
          {renderLines()}
        </g>
      </svg>

      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: "0 0",
        }}
      >
        {Array.from(positions.entries()).map(([id, pos]) => {
          const person = family.people[id];
          if (!person) return null;
          
          const spouse = getSpouse(person, family);
          
          return (
            <div key={id} style={{ position: "absolute", left: pos.x, top: pos.y, transform: "translate(-50%, -50%)" }}>
              <PersonCard 
                person={person} 
                onClick={() => setSelectedPerson(person)} 
                isSelected={selectedPerson?.id === person.id}
              />
              {spouse && positions.get(spouse.id) && (
                <div style={{ position: "absolute", left: positions.get(spouse.id)!.x - pos.x, top: 0, transform: "translate(-50%, -50%)" }}>
                  <PersonCard 
                    person={spouse} 
                    onClick={() => setSelectedPerson(spouse)} 
                    isSelected={selectedPerson?.id === spouse.id}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
