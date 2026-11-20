"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Pose } from "@/lib/yogiKnowledgeSchema";
import { resolveYogiImageUrl } from "@/lib/yogiImageUrl";
import styles from "./YogiIllustrationManager.module.css";

const MAX_FILE_BYTES = 4 * 1024 * 1024;

type UploadResponse = {
  ok?: boolean;
  pose?: Pose;
  error?: string;
  previous_asset_ref?: string | null;
  storage?: "blob" | "local";
  previous_blob_cleanup?: {
    status: "disabled" | "skipped" | "deleted" | "failed";
    pathname?: string;
    reason?: string;
  };
};

export default function YogiIllustrationManager() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pasteBusyRef = useRef(false);
  const [poses, setPoses] = useState<Pose[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pasteBusy, setPasteBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [previousUrl, setPreviousUrl] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/yogi-knowledge/poses", { cache: "no-store" });
      const result = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(result?.poses)) {
        throw new Error(result?.error ?? "A pózlista nem tölthető be.");
      }
      setPoses(result.poses as Pose[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const filtered = useMemo(() => {
    const needle = query.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return [...poses]
      .filter((pose) =>
        [pose.name_hu, pose.name_en, pose.sanskrit_name ?? "", pose.slug, pose.id]
          .join(" ")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .includes(needle),
      )
      .sort((a, b) => a.name_hu.localeCompare(b.name_hu, "hu"));
  }, [poses, query]);
  const selected = poses.find((pose) => pose.id === selectedId) ?? null;
  const currentUrl = resolveYogiImageUrl(selected?.mannequin_angled?.asset_ref);

  const resetDraft = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setConfirmed(false);
    setMessage("");
    setPreviousUrl("");
    setError("");
  };

  const chooseFile = useCallback((next: File | null) => {
    setMessage("");
    setPreviousUrl("");
    setConfirmed(false);
    setError("");
    if (!next) {
      setFile(null);
      return;
    }
    if (!(["image/png", "image/webp"].includes(next.type) || /\.(png|webp)$/i.test(next.name))) {
      setError("PNG vagy WebP képet válassz.");
      setFile(null);
      return;
    }
    if (next.size === 0 || next.size > MAX_FILE_BYTES) {
      setError("A kép túl nagy. Legfeljebb 4 MB-os PNG vagy WebP használható.");
      setFile(null);
      return;
    }
    setFile(next);
  }, []);

  // Listen at document level so Ctrl+V works after clicking the image preview,
  // without interfering with text pasting in the pose search field.
  useEffect(() => {
    let active = true;
    async function handlePaste(event: ClipboardEvent) {
      if (!selectedId || saving || pasteBusyRef.current) return;
      const target = event.target;
      if (target instanceof Element && target.closest('input, textarea, select, [contenteditable], [role="textbox"]')) return;
      const imageItem = Array.from(event.clipboardData?.items ?? []).find(
        (item) => item.kind === "file" && item.type.startsWith("image/"),
      );
      if (!imageItem) return;
      const pasted = imageItem.getAsFile();
      if (!pasted) return;
      event.preventDefault();
      pasteBusyRef.current = true;
      setPasteBusy(true);
      try {
        const stamp = Date.now();
        let nextFile: File;
        if ((pasted.type === "image/png" || pasted.type === "image/webp") && pasted.size <= MAX_FILE_BYTES) {
          const extension = pasted.type === "image/png" ? "png" : "webp";
          nextFile = new File([pasted], `yasuragi-vagolap-${stamp}.${extension}`, { type: pasted.type });
        } else {
          // Some clipboards provide JPEG/other images, or a PNG over the upload limit.
          // Convert locally to high-quality WebP without changing transparency.
          const bitmap = await createImageBitmap(pasted);
          try {
            const canvas = document.createElement("canvas");
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const context = canvas.getContext("2d");
            if (!context) throw new Error("Cannot prepare clipboard image");
            context.drawImage(bitmap, 0, 0);
            const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.96));
            if (!blob || blob.type !== "image/webp") throw new Error("Cannot convert clipboard image");
            nextFile = new File([blob], `yasuragi-vagolap-${stamp}.webp`, { type: "image/webp" });
          } finally {
            bitmap.close();
          }
        }
        if (active) chooseFile(nextFile);
      } catch {
        if (active) setError("A v\u00e1g\u00f3lap k\u00e9p\u00e9t nem siker\u00fclt beolvasni. Pr\u00f3b\u00e1ld f\u00e1jlk\u00e9nt felt\u00f6lteni.");
      } finally {
        pasteBusyRef.current = false;
        if (active) setPasteBusy(false);
      }
    }
    document.addEventListener("paste", handlePaste);
    return () => { active = false; document.removeEventListener("paste", handlePaste); };
  }, [chooseFile, selectedId, saving]);

  async function submit() {
    if (!selected || !file || !confirmed || saving || pasteBusy) return;
    setSaving(true);
    setError("");
    setMessage("");
    setPreviousUrl("");
    try {
      const body = new FormData();
      body.set("pose_id", selected.id);
      body.set("expected_asset_ref", selected.mannequin_angled?.asset_ref ?? "");
      body.set("file", file);
      const response = await fetch("/api/admin/yogi-knowledge/illustration", {
        method: "POST",
        body,
      });
      const result = (await response.json().catch(() => null)) as UploadResponse | null;
      if (!response.ok || !result?.ok || !result.pose) {
        throw new Error(result?.error ?? "A képcsere nem sikerült.");
      }
      setPoses((current) => current.map((pose) => pose.id === result.pose!.id ? result.pose! : pose));
      const cleanup = result.previous_blob_cleanup;
      setPreviousUrl(cleanup?.status === "deleted" ? "" : result.previous_asset_ref ?? "");
      setMessage(
        result.storage === "local"
          ? "Az új kép aktiválva a helyi fejlesztői környezetben. A Vercelre nincs feltöltve."
          : cleanup?.status === "deleted"
            ? "Az új illusztráció aktív, és a korábbi, már nem hivatkozott Blob-fájl törlődött."
            : cleanup?.status === "failed"
              ? "Az új illusztráció aktív, de a régi Blob törlése nem sikerült. Ellenőrizd a szervernaplót."
              : cleanup?.status === "skipped"
                ? "Az új illusztráció aktív. A régi Blob biztonsági okból megmaradt (például még használatban van)."
                : "Az új illusztráció aktív. A régi Blob megmaradt: az automatikus törlés még nincs bekapcsolva.",
      );
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setConfirmed(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.headerPanel}>
        <div className={styles.topbar}>
          <Link href="/admin/yogis-choice" className={styles.back}>← Vissza a Yasuragi adminba</Link>
          <button className={styles.secondaryButton} onClick={() => void refresh()} disabled={loading || saving || pasteBusy}>
            Pózlista frissítése
          </button>
        </div>
        <div className={styles.heading}>
          <p className={styles.eyebrow}>YASURAGI · ADMIN</p>
          <h1>Ászanaillusztrációk</h1>
          <p>Válassz pózt, nézd meg a jelenlegi képet, és tölts fel helyette egy újat. A csere az összes meglévő póznézetben megjelenik.</p>
        </div>
      </div>
      <div className={styles.layout}>
        <aside className={styles.listPane}>
          <label className={styles.searchLabel} htmlFor="illustration-pose-search">Pózkeresés ({poses.length})</label>
          <input
            id="illustration-pose-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Magyar, angol, szanszkrit név…"
            className={styles.search}
            autoComplete="off"
          />
          {loading ? <p className={styles.muted}>Pózok betöltése…</p> : null}
          <div className={styles.poseList}>
            {filtered.map((pose) => {
              const hasImage = pose.mannequin_angled?.status === "verified" && Boolean(pose.mannequin_angled.asset_ref);
              return (
                <button
                  key={pose.id}
                  type="button"
                  disabled={saving || pasteBusy}
                  onClick={() => { setSelectedId(pose.id); resetDraft(); }}
                  className={`${styles.poseItem} ${selectedId === pose.id ? styles.poseItemActive : ""}`}
                  aria-pressed={selectedId === pose.id}
                >
                  <span className={styles.poseName}>{pose.name_hu}</span>
                  <span className={styles.poseSub}>{pose.name_en}</span>
                  <span className={styles.poseStatus}>{hasImage ? "Van aktív kép" : "Nincs ellenőrzött kép"}</span>
                </button>
              );
            })}
            {!loading && filtered.length === 0 ? <p className={styles.muted}>Nincs találat.</p> : null}
          </div>
        </aside>
        <section className={styles.editor} aria-live="polite">
          {!selected ? (
            <div className={styles.empty}>Válassz egy pózt a bal oldali listából a kép cseréjéhez.</div>
          ) : (
            <>
              <div className={styles.selectedHeading}>
                <h2>{selected.name_hu}</h2>
                <p>{selected.name_en}{selected.sanskrit_name ? ` · ${selected.sanskrit_name}` : ""}</p>
                <code>{selected.id}</code>
              </div>
              <div className={styles.comparison}>
                <div>
                  <h3>Jelenlegi illusztráció</h3>
                  <div className={styles.previewFrame}>
                    {currentUrl ? <img src={currentUrl} alt={`${selected.name_hu} jelenlegi képe`} /> : <span>Nincs megjeleníthető kép</span>}
                  </div>
                  <p className={styles.caption}>{selected.mannequin_angled?.status === "verified" ? "Aktív" : "Nem ellenőrzött / hiányzik"}</p>
                </div>
                <div>
                  <h3>Új illusztráció</h3>
                  <div
                    className={`${styles.previewFrame} ${styles.newPreview}`}
                    tabIndex={saving ? -1 : 0}
                    role="group"
                    aria-label={"\u00daj illusztr\u00e1ci\u00f3: k\u00e9p beilleszt\u00e9se a v\u00e1g\u00f3lapr\u00f3l"}
                    onClick={(event) => event.currentTarget.focus()}
                  >
                    {preview ? <img src={preview} alt="Feltöltésre kiválasztott új kép" /> : (
                      <span>{"Kattints ide, majd Ctrl+V-vel illessz be egy k\u00e9pet, vagy v\u00e1lassz f\u00e1jlt alul."}</span>
                    )}
                  </div>
                  <p className={styles.caption}>{pasteBusy ? "\u00c1tvett k\u00e9p feldolgoz\u00e1sa..." : file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB` : "Átlátszó háttér ajánlott · maximum 4 MB"}</p>
                  <p className={styles.pasteHint}>{"V\u00e1g\u00f3lap: Ctrl+V (Mac: Cmd+V). A beillesztett k\u00e9pet ment\u00e9s el\u0151tt ugyan\u00fagy ellen\u0151rizheted."}</p>
                </div>
              </div>
              <div className={styles.actions}>
                <label className={styles.fileLabel} htmlFor="asana-image-file">Új kép kiválasztása</label>
                <input
                  key={selected.id}
                  ref={fileInputRef}
                  id="asana-image-file"
                  className={styles.fileInput}
                  type="file"
                  accept="image/png,image/webp"
                  disabled={saving || pasteBusy}
                  onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
                />
                {file && <label className={styles.checkLabel}>
                  <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
                  Ellenőriztem a pózt és az új kép előnézetét. Aktiválható.
                </label>}
                <button
                  className={styles.primaryButton}
                  onClick={() => void submit()}
                  disabled={!file || !confirmed || saving || pasteBusy}
                >
                  {saving ? "Kép feltöltése és aktiválása…" : "Illusztráció cseréje"}
                </button>
                <p className={styles.safety}>A mentés a kiválasztott póz képét frissíti. A régi Blob csak a teljes, ellenőrzött backup után engedélyezett biztonsági törléssel távolítható el.</p>
              </div>
            </>
          )}
          {error && <p className={styles.error} role="alert">{error}</p>}
          {message && <div className={styles.success} role="status">
            {message}
            {previousUrl && <p>Előző kép címe: <a href={resolveYogiImageUrl(previousUrl)} target="_blank" rel="noreferrer">Korábbi kép megnyitása</a></p>}
          </div>}
        </section>
      </div>
    </main>
  );
}
