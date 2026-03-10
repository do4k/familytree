export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  birthDate?: string;
  deathDate?: string;
  birthPlace?: string;
  photo?: string;
  isYou?: boolean;
  spouseId?: string;
  parentId?: string;
  generation: number;
}

export interface FamilyTree {
  rootId: string;
  people: Record<string, Person>;
}

export const loremFamily: FamilyTree = {
  rootId: "you",
  people: {
    you: {
      id: "you",
      firstName: "Alex",
      lastName: "Johnson",
      birthDate: "1990-03-15",
      birthPlace: "Chicago, IL",
      isYou: true,
      spouseId: "spouse1",
      parentId: "father1",
      generation: 0,
    },
    spouse1: {
      id: "spouse1",
      firstName: "Morgan",
      lastName: "Johnson",
      birthDate: "1992-07-22",
      birthPlace: "Seattle, WA",
      spouseId: "you",
      generation: 0,
    },
    father1: {
      id: "father1",
      firstName: "Robert",
      lastName: "Johnson",
      birthDate: "1960-11-08",
      birthPlace: "Boston, MA",
      spouseId: "mother1",
      parentId: "grandfather1",
      generation: 1,
    },
    mother1: {
      id: "mother1",
      firstName: "Patricia",
      lastName: "Johnson",
      birthDate: "1962-05-30",
      birthPlace: "Denver, CO",
      spouseId: "father1",
      parentId: "grandfather2",
      generation: 1,
    },
    grandfather1: {
      id: "grandfather1",
      firstName: "William",
      lastName: "Johnson",
      birthDate: "1935-02-14",
      birthPlace: "New York, NY",
      spouseId: "grandmother1",
      generation: 2,
    },
    grandmother1: {
      id: "grandmother1",
      firstName: "Dorothy",
      lastName: "Johnson",
      birthDate: "1938-09-20",
      birthPlace: "Philadelphia, PA",
      spouseId: "grandfather1",
      generation: 2,
    },
    grandfather2: {
      id: "grandfather2",
      firstName: "James",
      lastName: "Anderson",
      birthDate: "1940-12-01",
      birthPlace: "Portland, OR",
      spouseId: "grandmother2",
      generation: 2,
    },
    grandmother2: {
      id: "grandmother2",
      firstName: "Barbara",
      lastName: "Anderson",
      birthDate: "1942-04-18",
      birthPlace: "San Francisco, CA",
      spouseId: "grandfather2",
      generation: 2,
    },
    child1: {
      id: "child1",
      firstName: "Emma",
      lastName: "Johnson",
      birthDate: "2018-08-10",
      birthPlace: "Chicago, IL",
      parentId: "you",
      generation: -1,
    },
    child2: {
      id: "child2",
      firstName: "Liam",
      lastName: "Johnson",
      birthDate: "2020-02-28",
      birthPlace: "Chicago, IL",
      parentId: "you",
      generation: -1,
    },
    sibling1: {
      id: "sibling1",
      firstName: "Sarah",
      lastName: "Johnson",
      birthDate: "1988-06-12",
      birthPlace: "Chicago, IL",
      parentId: "father1",
      generation: 0,
    },
    sibling1Spouse: {
      id: "sibling1Spouse",
      firstName: "David",
      lastName: "Miller",
      birthDate: "1985-10-05",
      birthPlace: "Austin, TX",
      spouseId: "sibling1",
      generation: 0,
    },
    niece1: {
      id: "niece1",
      firstName: "Olivia",
      lastName: "Miller",
      birthDate: "2015-03-22",
      birthPlace: "Austin, TX",
      parentId: "sibling1",
      generation: -1,
    },
  },
};
