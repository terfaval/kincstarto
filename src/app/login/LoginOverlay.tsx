"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./login.module.css";

export default function LoginOverlay() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, remember: rememberMe }),
      });

      if (!response.ok) {
        throw new Error("Invalid credentials");
      }

      router.replace("/admin");
    } catch {
      setError("Hibás e-mail vagy jelszó.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-overlay-backdrop">
      <div className={`admin-overlay-panel ${styles.panel}`}>
        <div className={styles.header}>
          <h1 className={styles.title}>{"Admin belépés"}</h1>
          <p className={styles.subtitle}>{"A folytatáshoz add meg az e-mail címet és a jelszót."}</p>
        </div>
        <form className={styles.form} onSubmit={onSubmit}>
          <label className="form-field">
            <span className="form-field__label">E-mail</span>
            <input
              className="input"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className="form-field">
            <span className="form-field__label">Jelszó</span>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <label className={styles.rememberRow}>
            <input
              type="checkbox"
              className={styles.rememberCheckbox}
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
            />
            <span className={styles.rememberLabel}>{"EmlĂ©kezz rĂˇm (kijelentkezĂ©sig)"}</span>
          </label>
          {error && <p className="admin-message admin-message--error">{error}</p>}
          <div className={styles.actions}>
            <button type="submit" className="btn btn--primary" disabled={loading}>
              {loading ? "Beléptetés..." : "Belépés"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
