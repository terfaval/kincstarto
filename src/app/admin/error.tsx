"use client";

import { useRouter } from "next/navigation";

/** A transient server-side Blob read must not strand the admin on a dev error screen. */
export default function AdminLoadError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  return (
    <main role="alert" style={{ maxWidth: 560, margin: "12vh auto", padding: "24px", color: "#413b32", background: "#f8f2e7", borderRadius: 12 }}>
      <h1 style={{ fontFamily: "Georgia, serif", fontSize: "1.6rem" }}>Az adminoldal most nem tölthető be</h1>
      <p>Lehet, hogy a Shiori könyvtárának frissített változata még nem érhető el a tárolóból. A mentést ne ismételd meg automatikusan.</p>
      <button type="button" onClick={() => { reset(); router.refresh(); }} style={{ padding: "11px 17px", border: "1px solid #627667", borderRadius: 8, background: "#405b51", color: "white", cursor: "pointer" }}>
        Betöltés újrapróbálása
      </button>
    </main>
  );
}
