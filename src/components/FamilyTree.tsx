"use client";

import { useState } from "react";
import type { Person, FamilyTree } from "@/lib/family";

interface FamilyTreeProps {
  family: FamilyTree;
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

function PersonCard({ person, onClick }: { person: Person; onClick: () => void }) {
  const initials = person.lastName 
    ? `${person.firstName[0]}${person.lastName[0]}` 
    : person.firstName[0];
  const birthYear = person.birthDate ? new Date(person.birthDate).getFullYear() : "";
  const deathYear = person.deathDate ? new Date(person.deathDate).getFullYear() : "";

  return (
    <div
      className={`tree-person ${person.isYou ? "is-you" : ""}`}
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

function FamilyRow({ 
  title, 
  people, 
  family, 
  onPersonClick 
}: { 
  title: string; 
  people: Person[]; 
  family: FamilyTree;
  onPersonClick: (p: Person) => void;
}) {
  if (people.length === 0) return null;

  return (
    <div className="flex flex-col items-center">
      <span style={{ color: "var(--pie-secondary-light)", fontSize: "12px", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
        {title}
      </span>
      <div className="flex justify-center gap-8" style={{ marginBottom: "24px" }}>
        {people.map((person) => (
          <div key={person.id} className="tree-node">
            <PersonCard person={person} onClick={() => onPersonClick(person)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ViewSelector({ 
  root, 
  onBack 
}: { 
  root: Person; 
  onBack: () => void;
}) {
  return (
    <div className="flex items-center gap-4 mb-6">
      <button 
        onClick={onBack}
        className="btn btn-secondary"
        style={{ padding: "8px 16px", fontSize: "14px" }}
      >
        ← Back
      </button>
      <span style={{ color: "var(--pie-secondary-light)" }}>Viewing:</span>
      <span style={{ fontWeight: 600 }}>{root.firstName} {root.lastName}'s family</span>
    </div>
  );
}

export default function FamilyTree({ family }: FamilyTreeProps) {
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(
    family.people[family.rootId]
  );

  const root = selectedPerson || family.people[family.rootId];
  const spouse = getSpouse(root, family);
  const children = getChildren(root, family);
  const siblings = getSiblings(root, family);
  const parents = getParents(root, family);

  const uniqueParents = parents.filter((p, i, arr) => 
    arr.findIndex(x => x.id === p.id) === i
  );

  return (
    <div className="w-full overflow-auto p-8">
      {selectedPerson && selectedPerson.id !== family.rootId && (
        <ViewSelector 
          root={selectedPerson} 
          onBack={() => setSelectedPerson(family.people[family.rootId])} 
        />
      )}
      
      <div className="flex flex-col items-center">
        <FamilyRow 
          title="Parents" 
          people={uniqueParents} 
          family={family} 
          onPersonClick={setSelectedPerson} 
        />

        <div className="flex justify-center gap-8">
          <div className="tree-node">
            <PersonCard
              person={root}
              onClick={() => root.id !== family.rootId ? setSelectedPerson(root) : () => {}}
            />
          </div>
          {spouse && (
            <div className="tree-node">
              <PersonCard
                person={spouse}
                onClick={() => setSelectedPerson(spouse)}
              />
            </div>
          )}
        </div>

        <FamilyRow 
          title="Children" 
          people={children} 
          family={family} 
          onPersonClick={setSelectedPerson} 
        />
        
        <FamilyRow 
          title="Siblings" 
          people={siblings} 
          family={family} 
          onPersonClick={setSelectedPerson} 
        />
      </div>

      {selectedPerson && (
        <div className="fixed bottom-4 right-4 card max-w-sm">
          <h3 className="font-semibold text-lg mb-2">
            {selectedPerson.firstName} {selectedPerson.lastName}
          </h3>
          {selectedPerson.birthDate && (
            <p className="text-sm" style={{ color: "var(--pie-secondary-light)" }}>
              Born: {new Date(selectedPerson.birthDate).toLocaleDateString("en-GB")}
            </p>
          )}
          {selectedPerson.isYou && (
            <p className="text-sm" style={{ color: "var(--pie-primary)", fontWeight: 600, marginTop: "8px" }}>This is you</p>
          )}
        </div>
      )}
    </div>
  );
}
