# Yasuragi P02.1 - preliminary API error diagnostics

The original P02 preview endpoint reported both pose-library and validation exceptions as a private draft-store outage. This patch introduces distinct phase codes without modifying import formats, draft persistence, practice data, or authorization.

- YAS_P02_POSE_LIBRARY (503): live pose-library read failed before validation.
- YAS_P02_VALIDATOR (500): authoring validation threw unexpectedly. A normal, invalid JSON document should instead produce a structured validation report.
- YAS_P02_DRAFT_STORE (503): validation succeeded but draft save failed.
- YAS_P02_SAVE_UNCERTAIN (502): draft write may have succeeded; check existing drafts before retrying.

Reproduce the import preview on localhost and note the new code. For development only, inspect the `npm run dev` terminal for `[Yasuragi P02]` and the associated error stack. Never share Blob tokens, headers, `.env.local`, or credentials in an error report.

This is a diagnostic patch, not a confirmed underlying-cause fix. Do not disable the live catalog safety checks or silently substitute repository fixtures for live pose data.
