/** Read-only post-import readiness check. A failed read is not a failed write. */
export async function waitForShioriRevision(
  expectedSha: string,
  readBaseSha: () => Promise<string | null>,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  delays: readonly number[] = [0, 450, 1200, 2400, 4800],
): Promise<boolean> {
  for (const delay of delays) {
    if (delay > 0) await wait(delay);
    try {
      if ((await readBaseSha()) === expectedSha) return true;
    } catch {
      // A transient stale Blob read may fail. Never retry the POST write.
    }
  }
  return false;
}
