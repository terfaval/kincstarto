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
  const debugParam = searchParams?.debug;
  const debugEnabled = Array.isArray(debugParam)
    ? debugParam.includes("1")
    : debugParam === "1";
  return (
    <>
      {debugEnabled && (
        <div
          style={{
            position: "fixed",
            top: "8px",
            right: "8px",
            padding: "6px 8px",
            background: "rgba(40, 120, 60, 0.92)",
            color: "#fff",
            fontSize: "12px",
            borderRadius: "6px",
            zIndex: 10000,
          }}
        >
          {"SSR debug=1"}
        </div>
      )}
      <SpiritLibraryApp library={library} admin={false} />
    </>
  );
}
