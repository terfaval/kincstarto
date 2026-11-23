"use client";

import Image from "next/image";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import styles from "./login.module.css";

export default function LoginOverlay() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, remember: rememberMe }),
      });

      if (response.status === 401) {
        setError("Hibás e-mail-cím vagy jelszó.");
        return;
      }
      if (!response.ok) {
        setError("A belépés most nem sikerült. Próbáld meg később.");
        return;
      }
      // A teljes navigáció új szerverkérést indít az imént beállított
      // HttpOnly sütivel; nem használ korábbi, kijelentkezett RSC állapotot.
      window.location.replace("/admin");
    } catch {
      setError("Nem sikerült kapcsolódni. Ellenőrizd a kapcsolatot, és próbáld újra.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="admin-login-title">
        <Link href="/" className={styles.backLink}>Vissza a főoldalra</Link>

        <header className={styles.header}>
          <Image src="/logo.svg" alt="" width={76} height={76} className={styles.mark} priority />
          <p className={styles.eyebrow}>Kincstartó · személyes tér</p>
          <h1 className={styles.title} id="admin-login-title">Adminbelépés</h1>
          <p className={styles.subtitle}>A folytatáshoz jelentkezz be a hozzáféréseddel.</p>
        </header>

        <form className={styles.form} onSubmit={onSubmit}>
          <label className={styles.field}>
            <span className={styles.label}>E-mail-cím</span>
            <input
              className={styles.input}
              type="email"
              name="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              inputMode="email"
              placeholder="E-mail-címed"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={loading}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Jelszó</span>
            <span className={styles.passwordField}>
              <input
                className={styles.input}
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                placeholder="Jelszavad"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                disabled={loading}
              />
              <button
                type="button"
                className={styles.visibilityButton}
                onClick={() => setShowPassword((shown) => !shown)}
                aria-label={showPassword ? "Jelszó elrejtése" : "Jelszó megjelenítése"}
                aria-pressed={showPassword}
                disabled={loading}
              >
                {showPassword ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
              </button>
            </span>
          </label>

          <label className={styles.rememberRow}>
            <input
              type="checkbox"
              className={styles.rememberCheckbox}
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              disabled={loading}
            />
            <span>Maradjak bejelentkezve ezen az eszközön (30 nap)</span>
          </label>

          {error && <p role="alert" className={styles.error}>{error}</p>}
          <button type="submit" className={styles.submit} disabled={loading}>
            {loading ? "Beléptetés…" : "Belépés"}
          </button>
        </form>
      </section>
    </main>
  );
}
