"use client";

import { useState, type FormEvent } from "react";
import type { SpiritBook, SpiritStatus } from "@/lib/spiritSchema";
import styles from "./ShioriPrivateBookPanel.module.css";

type Props = {
  book: SpiritBook;
  onSaved: (id: string, status: SpiritStatus, notes: string) => void;
};

const OPTIONS: { value: SpiritStatus; label: string }[] = [
  { value: "olvasatlan", label: "Olvasatlan" },
  { value: "folyamatban", label: "Folyamatban" },
  { value: "befejezett", label: "Befejezett" },
  { value: "referencia", label: "Referencia" },
];

/** Rendered only with verified admin-scoped private props; never mounted on /library. */
export default function ShioriPrivateBookPanel({ book, onSaved }: Props) {
  const [status, setStatus] = useState<SpiritStatus>(book.status);
  const [notes, setNotes] = useState(book.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState({ status: book.status, notes: book.notes ?? "" });
  const dirty = status !== saved.status || notes.trim() !== saved.notes;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty || busy || locked) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/spirit/status", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: book.id, status, notes }),
      });
      const result: unknown = await response.json();
      if (!response.ok || !result || typeof result !== "object" ||
        (result as { ok?: boolean }).ok !== true ||
        !OPTIONS.some((option) => option.value === (result as { status?: string }).status) ||
        typeof (result as { notes?: string }).notes !== "string") {
        throw new Error("A mentés nem igazolható. Frissítsd az oldalt, ne ismételd automatikusan.");
      }
      const data = result as { status: SpiritStatus; notes: string };
      setStatus(data.status);
      setNotes(data.notes);
      setSaved({ status: data.status, notes: data.notes });
      onSaved(book.id, data.status, data.notes);
      setMessage("Belső állapot mentve.");
    } catch {
      setLocked(true);
      setMessage("A mentés kimenetele bizonytalan. Frissítsd az oldalt és ellenőrizd az állapotot; ne ismételd a mentést.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.panel} aria-label="Kizárólag admin: könyv belső állapota">
      <h3>Belső állapot</h3>
      <form onSubmit={save} className={styles.form}>
        <label className={styles.field}>Olvasottság
          <select value={status} onChange={(event) => { setStatus(event.target.value as SpiritStatus); setMessage(""); }} disabled={busy || locked}>
            {OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className={styles.field}>Szerkesztői megjegyzés · csak neked
          <textarea rows={3} value={notes} onChange={(event) => { setNotes(event.target.value); setMessage(""); }} disabled={busy || locked} placeholder="Belső megjegyzés…" />
        </label>
        <div className={styles.actions}>
          <button type="submit" disabled={!dirty || busy || locked}>{busy ? "Mentés…" : "Mentés"}</button>
          {message && <span role="status" className={styles.message}>{message}</span>}
        </div>
      </form>
    </section>
  );
}
