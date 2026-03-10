"use client";

import { useState } from "react";
import type { Person, FamilyTree } from "@/lib/family";

interface FamilyTreeProps {
  family: FamilyTree;
}

interface TreeNodeProps {
  person: Person;
  family: FamilyTree;
  onPersonClick: (person: Person) => void;
}

function getSpouse(person: Person, family: FamilyTree): Person | undefined {
  if (!person.spouseId) return undefined;
  return family.people[person.spouseId];
}

function getChildren(person: Person, family: FamilyTree): Person[] {
  return Object.values(family.people).filter((p) => p.parentId === person.id);
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
  const initials = `${person.firstName[0]}${person.lastName[0]}`;
  const birthYear = person.birthDate ? new Date(person.birthDate).getFullYear() : "?";
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

function ParentsRow({ person, family, onPersonClick }: TreeNodeProps) {
  const parents = getParents(person, family);
  if (parents.length === 0) return null;

  const uniqueParents = parents.filter((p, i, arr) => 
    arr.findIndex(x => x.id === p.id) === i
  );

  return (
    <div className="flex justify-center gap-8 mb-8">
      {uniqueParents.map((parent) => (
        <div key={parent.id} className="tree-node">
          <PersonCard person={parent} onClick={() => onPersonClick(parent)} />
          {getSpouse(parent, family) && (
            <PersonCard
              person={getSpouse(parent, family)!}
              onClick={() => onPersonClick(getSpouse(parent, family)!)}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function ChildrenRow({ person, family, onPersonClick }: TreeNodeProps) {
  const children = getChildren(person, family);
  if (children.length === 0) return null;

  return (
    <div className="flex justify-center gap-8 mt-8">
      {children.map((child) => (
        <div key={child.id} className="tree-node">
          <PersonCard person={child} onClick={() => onPersonClick(child)} />
        </div>
      ))}
    </div>
  );
}

function SiblingsRow({ person, family, onPersonClick }: TreeNodeProps) {
  if (!person.parentId) return null;
  
  const siblings = Object.values(family.people).filter(
    (p) => p.parentId === person.parentId && p.id !== person.id
  );

  if (siblings.length === 0) return null;

  return (
    <div className="flex justify-center gap-8 mt-8">
      {siblings.map((sibling) => {
        const siblingSpouse = sibling.spouseId ? family.people[sibling.spouseId] : undefined;
        return (
          <div key={sibling.id} className="tree-node">
            <PersonCard person={sibling} onClick={() => onPersonClick(sibling)} />
            {siblingSpouse && (
              <PersonCard
                person={siblingSpouse}
                onClick={() => onPersonClick(siblingSpouse)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function FamilyTree({ family }: FamilyTreeProps) {
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(
    family.people[family.rootId]
  );

  const root = family.people[family.rootId];
  const spouse = getSpouse(root, family);

  return (
    <div className="w-full overflow-auto p-8">
      <div className="flex flex-col items-center">
        <ParentsRow person={root} family={family} onPersonClick={setSelectedPerson} />
        
        <div className="flex justify-center gap-8">
          <div className="tree-node">
            <PersonCard
              person={root}
              onClick={() => setSelectedPerson(root)}
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

        <ChildrenRow person={root} family={family} onPersonClick={setSelectedPerson} />
        
        <SiblingsRow person={root} family={family} onPersonClick={setSelectedPerson} />
      </div>

      {selectedPerson && (
        <div className="fixed bottom-4 right-4 card max-w-sm">
          <h3 className="font-semibold text-lg mb-2">
            {selectedPerson.firstName} {selectedPerson.lastName}
          </h3>
          {selectedPerson.birthPlace && (
            <p className="text-sm text-gray-500">Born: {selectedPerson.birthPlace}</p>
          )}
          {selectedPerson.isYou && (
            <p className="text-sm text-pie-primary font-medium mt-2">This is you</p>
          )}
        </div>
      )}
    </div>
  );
}
