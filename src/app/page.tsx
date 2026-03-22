import { loadSpiritLibrary } from "@/lib/spiritLibrary";
import SpiritLibraryApp from "@/components/spirit/SpiritLibraryApp";

export const metadata = {
  title: "Spirit Library",
};

export default async function SpiritPage() {
  const library = await loadSpiritLibrary();
  return <SpiritLibraryApp library={library} />;
}
