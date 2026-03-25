import { loadSpiritLibrary } from "@/lib/spiritLibrary";
import SpiritLibraryApp from "@/components/spirit/SpiritLibraryApp";

export const metadata = {
  title: "Kincstartó",
  description: "Könyvek és gondolatok személyes gyűjteménye a belső út kereséséhez",
};

export const dynamic = "force-dynamic";

export default async function SpiritPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const library = await loadSpiritLibrary();
  return (
    <SpiritLibraryApp library={library} admin={false} />
  );
}
