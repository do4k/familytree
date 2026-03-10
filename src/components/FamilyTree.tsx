"use client";

import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import type { Person, FamilyTree } from "@/lib/family";

interface FamilyTreeProps {
  family: FamilyTree;
}

interface Position {
  x: number;
  y: number;
}

interface TreeNode {
  person: Person;
  position: Position;
  spouse?: Person;
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
      style={{
        position: "absolute",
        transform: "translate(-50%, -50%)",
      }}
    >
      <div className="tree-avatar">{initials}</div>
      <div className="tree-name">{person.firstName} {person.lastName}</div>
      <div className="tree-dates">
        {birthYear} {deathYear ? `— ${deathYear}` : ""}
      </div>
    </div>
  );
}

function calculateTreeLayout(root: Person, family: FamilyTree, baseY: number = 100): Map<string, Position> {
  const positions = new Map<string, Position>();
  const nodeWidth = 180;
  const nodeHeight = 120;
  const siblingSpacing = 40;
  const generationGap = 100;

  const parents = getParents(root, family);
  if (parents.length > 0) {
    const parentCenter = baseY;
    parents.forEach((parent, idx) => {
      const offset = (idx - (parents.length - 1) / 2) * (nodeWidth + siblingSpacing);
      positions.set(parent.id, { x: parentCenter + offset, y: baseY - generationGap });
      
      const spouse = getSpouse(parent, family);
      if (spouse) {
        positions.set(spouse.id, { x: parentCenter + offset + nodeWidth + siblingSpacing, y: baseY - generationGap });
      }
    });
  }

  const rootX = baseY;
  positions.set(root.id, { x: rootX, y: baseY });
  
  const spouse = getSpouse(root, family);
  if (spouse) {
    positions.set(spouse.id, { x: rootX + nodeWidth + siblingSpacing, y: baseY });
  }

  const siblings = getSiblings(root, family);
  const allChildren = [...siblings, root];
  const totalWidth = allChildren.length * (nodeWidth + siblingSpacing) - siblingSpacing;
  const startX = baseY - totalWidth / 2 + nodeWidth / 2;
  
  siblings.forEach((sibling, idx) => {
    const x = startX + idx * (nodeWidth + siblingSpacing);
    positions.set(sibling.id, { x, y: baseY });
    
    const siblingSpouse = getSpouse(sibling, family);
    if (siblingSpouse) {
      positions.set(siblingSpouse.id, { x: x + nodeWidth + siblingSpacing, y: baseY });
    }
  });

  const children = getChildren(root, family);
  if (children.length > 0) {
    const childCount = children.length;
    const childTotalWidth = childCount * (nodeWidth + siblingSpacing) - siblingSpacing;
    const childStartX = rootX - childTotalWidth / 2 + nodeWidth / 2;
    
    children.forEach((child, idx) => {
      positions.set(child.id, { x: childStartX + idx * (nodeWidth + siblingSpacing), y: baseY + generationGap });
    });
  }

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
    const nodeWidth = 180;
    const nodeHeight = 120;

    const parents = getParents(root, family);
    parents.forEach(parent => {
      const parentPos = positions.get(parent.id);
      const rootPos = positions.get(root.id);
      if (parentPos && rootPos) {
        lines.push(
          <path
            key={`line-${parent.id}`}
            d={`M ${parentPos.x} ${parentPos.y + nodeHeight / 2} 
                L ${parentPos.x} ${parentPos.y + nodeHeight / 2 + 50} 
                L ${rootPos.x} ${parentPos.y + nodeHeight / 2 + 50} 
                L ${rootPos.x} ${rootPos.y - nodeHeight / 2}`}
            className="tree-connection-line"
          />
        );
      }
    });

    const siblings = getSiblings(root, family);
    const siblingsAndRoot = [...siblings, root];
    siblingsAndRoot.forEach(sibling => {
      const siblingPos = positions.get(sibling.id);
      const rootPos = positions.get(root.id);
      if (siblingPos && rootPos && sibling.id !== root.id) {
        lines.push(
          <path
            key={`line-sibling-${sibling.id}`}
            d={`M ${siblingPos.x} ${siblingPos.y - nodeHeight / 2} 
                L ${siblingPos.x} ${siblingPos.y - nodeHeight / 2 - 30} 
                L ${rootPos.x} ${siblingPos.y - nodeHeight / 2 - 30} 
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
                L ${rootPos.x} ${rootPos.y + nodeHeight / 2 + 30} 
                L ${childPos.x} ${rootPos.y + nodeHeight / 2 + 30} 
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
            <div key={id} style={{ position: "absolute", left: pos.x, top: pos.y }}>
              <PersonCard 
                person={person} 
                onClick={() => setSelectedPerson(person)} 
                isSelected={selectedPerson?.id === person.id}
              />
              {spouse && positions.get(spouse.id) && (
                <div style={{ position: "absolute", left: positions.get(spouse.id)!.x - pos.x, top: 0 }}>
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
