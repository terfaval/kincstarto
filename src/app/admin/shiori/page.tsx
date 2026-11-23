import { loadSpiritLibrary } from "@/lib/spiritLibrary";
import { publicShioriCatalog } from "@/lib/shioriCatalog";
import { privateShioriReady } from "@/lib/shioriPrivateBlob";
import { isAdminRequest } from "@/lib/adminAuth";
import { redirect } from "next/navigation";
import SpiritLibraryApp from "@/components/spirit/SpiritLibraryApp";

export const metadata = {
  title: "Shiori admin · Kincstartó",
};

// After a verified JSON import, router.refresh() must read the latest catalog.
export const dynamic = "force-dynamic";

export default async function SpiritAdminPage() {
  // Verify in the page as well: layouts and pages may render concurrently.
  if (!(await isAdminRequest())) redirect("/login");
  // The public /shiori route must never request or serialize this private state.
  const privateEnabled = privateShioriReady();
  const library = privateEnabled
    ? await loadSpiritLibrary({ includePrivate: true })
    : publicShioriCatalog(await loadSpiritLibrary());
  // Local development may not have access to Vercel's production/preview Secret.
  // In that case show only a clearly labelled visual sample of the cover icons;
  // never pretend to load or enable editing real private state.
  const localStatusPreview = process.env.NODE_ENV === "development" && !privateEnabled;
  return <SpiritLibraryApp library={library} admin privateEnabled={privateEnabled} localStatusPreview={localStatusPreview} />;
}
