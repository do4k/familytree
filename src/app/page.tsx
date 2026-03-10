import FamilyTree from "@/components/FamilyTree";
import { loremFamily } from "@/lib/family";

export default function Home() {
  return <FamilyTree family={loremFamily} />;
}
