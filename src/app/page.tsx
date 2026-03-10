import FamilyTree from "@/components/FamilyTree";
import { loremFamily } from "@/lib/family";

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-pie-border py-4 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-semibold">Family Tree</h1>
          <a
            href="https://github.com/do4k/familytree"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-pie-secondary hover:text-pie-primary"
          >
            GitHub
          </a>
        </div>
      </header>
      
      <main>
        <FamilyTree family={loremFamily} />
      </main>
    </div>
  );
}
