import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Kincstartó",
    short_name: "Kincstartó",
    description: "Spirituális könyvtár szűréssel és AI-tervezett bejegyzésekkel",
    lang: "hu-HU",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0a1324",
    theme_color: "#0a1324",
    icons: [
      {
        src: "/icons/kincstarto-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/kincstarto-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
