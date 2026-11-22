"use client";

import { useState, type FormEvent } from "react";
import type { SpiritBook, SpiritPath } from "@/lib/spiritSchema";
import styles from "./ShioriPrivatePathPanel.module.css";

type Props = { path: SpiritPath; books: SpiritBook[]; onSaved: (id: string, change: { progress?: number; comment?: { bookId: string; text: string } }) => void };

/** Scoped to the selected path on the authorized admin shelf only. */
export default function ShioriPrivatePathPanel({ path, books, onSaved }: Props) {
  const [progress, setProgress] = useState(path.progress ?? 0);
  const [confirmedProgress, setConfirmedProgress] = useState(path.progress ?? 0);
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  const [message, setMessage] = useState("");
  const [comments, setComments] = useState<Record<string, string>>(() =>
    Object.fromEntries((path.items ?? []).map((item) => [item.book_id, item.comment ?? ""])));
  const [originalComments, setOriginalComments] = useState<Record<string, string>>(() =>
    Object.fromEntries((path.items ?? []).map((item) => [item.book_id, item.comment ?? ""])));
  const progressChanged = progress !== confirmedProgress;
  const changedComments = Object.keys(comments).filter((id) => comments[id].trim() !== (originalComments[id] ?? ""));

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || locked || (!progressChanged && !changedComments.length)) return;
    setBusy(true); setMessage("");
    try {
      // Persist one change per request: no automated retry or multi-write after an uncertain outcome.
      const changes: Array<{ progress: number } | { itemComment: { bookId: string; comment: string } }> = [
        ...(progressChanged ? [{ progress }] : []),
        ...changedComments.map((bookId) => ({ itemComment: { bookId, comment: comments[bookId] } })),
      ];
      for (const change of changes) {
        const response = await fetch("/api/admin/spirit/path", {
          method: "POST", credentials: "same-origin", cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pathId: path.id, ...change }),
        });
        const result: unknown = await response.json();
        if (!response.ok || !result || typeof result !== "object" || (result as { ok?: boolean }).ok !== true) {
          throw new Error("A mentés nem igazolható.");
        }
        if ("progress" in change) {
          setConfirmedProgress(change.progress);
          onSaved(path.id, { progress: change.progress });
        } else {
          const text = change.itemComment.comment.trim();
          setOriginalComments((prev) => ({ ...prev, [change.itemComment.bookId]: text }));
          onSaved(path.id, { comment: { bookId: change.itemComment.bookId, text } });
        }
      }
      setMessage("A belső haladás mentve.");
    } catch {
      setLocked(true);
      setMessage("Egy mentés eredménye bizonytalan. Frissítsd az oldalt és ellenőrizd a privát adatokat; ne ismételd automatikusan.");
    } finally { setBusy(false); }
  }

  const titleFor = (bookId: string) => books.find((book) => book.id === bookId)?.title ?? bookId;
  return (
    <details className={styles.disclosure}>
      <summary>Belső haladás <strong>{confirmedProgress}%</strong></summary>
      <form onSubmit={save} className={styles.form}>
        <label className={styles.progressLabel}>
          <span>Olvasási út előrehaladása</span>
          <span className={styles.progressInput}>
            <input type="number" min={0} max={100} step={1} value={progress} disabled={busy || locked}
              onChange={(event) => { const raw = event.target.value; if (raw !== "" && Number.isFinite(Number(raw))) setProgress(Math.min(100, Math.max(0, Math.round(Number(raw))))); setMessage(""); }} />
            <span>%</span>
          </span>
        </label>
        {(path.items ?? []).length > 0 && <div className={styles.comments}>
          <h3>Belső útvonaljegyzetek</h3>
          {(path.items ?? []).map((item) => <label key={item.book_id} className={styles.commentField}>
            {titleFor(item.book_id)}
            <textarea rows={2} disabled={busy || locked} value={comments[item.book_id] ?? ""}
              onChange={(event) => { setComments((prev) => ({ ...prev, [item.book_id]: event.target.value })); setMessage(""); }} />
          </label>)}
        </div>}
        <div className={styles.actions}>
          <button type="submit" disabled={busy || locked || (!progressChanged && changedComments.length === 0)}>{busy ? "Mentés…" : "Belső állapot mentése"}</button>
          {message && <span role="status">{message}</span>}
        </div>
      </form>
    </details>
  );
}
