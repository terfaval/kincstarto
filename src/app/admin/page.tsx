import { loadSpiritLibrary } from "@/lib/spiritLibrary";
import SpiritLibraryApp from "@/components/spirit/SpiritLibraryApp";

export const metadata = {
  title: "Spirit Library Admin",
};

export default async function SpiritAdminPage() {
  const library = await loadSpiritLibrary();
  return <SpiritLibraryApp library={library} admin />;
}
