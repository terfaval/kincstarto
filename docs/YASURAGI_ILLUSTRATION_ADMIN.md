# Yasuragi – illustration replacement (initial safe rollout)

## Current repository mapping

- Existing Yasuragi/Yogi's Choice admin: `/admin/yogis-choice`.
- New image replacement manager: `/admin/yogis-choice/illustrations` (linked from the existing admin).
- Canonical *active* display slot remains `Pose.mannequin_angled.asset_ref` with `status: verified`. This is deliberate backward compatibility with the pose gallery, pose detail and yoga-video pose thumbnails. Do not rename/remove other image slots in this patch.
- The new admin endpoint is `POST /api/admin/yogi-knowledge/illustration`, protected by the current admin cookie. It accepts `multipart/form-data`: `pose_id`, `expected_asset_ref` and `file` (PNG or WebP; 4 MiB maximum; 128–4096 px per side).
- Uploaded image gets a new unique `yogi/images/<slug>/illustration-<random>-<timestamp>.<format>` object path, using the existing `saveYogiImageAsset`. One reference per pose is **active in the JSON**. It does **not** mean the legacy files have already been removed from storage.
- The endpoint checks the previous reference before saving, reads poses again before committing, then updates just that slot, preserving the pose's other content. No old Blob deletion. Existing public views use the stored image reference automatically.

## Safe steps

1. Test in local development with a throwaway image. Without `BLOB_READ_WRITE_TOKEN`, the application writes the image and poses JSON locally (under `public/yogi-images/` and `data/yogi/`). **Do not commit local test image/data changes.**
2. For deployment, ensure `ADMIN_KEY` / `ADMIN_PASSWORD` and `BLOB_READ_WRITE_TOKEN` are set on the intended environment. The endpoint refuses production uploads if either is missing.
3. In admin, select a pose, choose the new image, inspect side-by-side, check the confirmation and click **Illusztráció cseréje**. Existing publicly displayed images update as soon as the JSON write succeeds (new URL = no old-image cache collision).
4. Confirm a published pose sheet and a yoga video pose thumbnail both display the replacement.
5. Never delete previous Blob objects before building a complete, verified backup of existing `yogi/images/` objects **and** their original references. A separate follow-up can add admin-backed old-file cleanup with orphan detection, downloadable manifest and guarded deletion. Do not delete `mannequin_front` images or any media based only on the source ZIP's contents.

## Risks and limits

- The UI uploads through a server function. Files larger than 4 MiB must be optimized first. A future direct-to-Blob client-upload flow can support larger files.
- `mannequin_front` (old backup slot) and old `mannequin_angled` assets are untouched. This is not yet the requested Blob cleanup/migration. To enforce a single *stored* image per pose, first back up the old files and confirm no other dataset references them.
- The old, general-purpose draft editor remains available. Saving a stale draft from another browser tab could overwrite a later image reference. Refresh that editor after replacements; cross-tab transactional locking is a future hardening task.
- Concurrent serverless writers do not share a global lock; the expected-reference check reduces but does not eliminate races across different instances.
- `Pose` image validation currently trusts the admin's manual approval; the pose must be checked for anatomical accuracy before activation.
- The deployment's actual Blob token, remote assets and end-to-end upload flow cannot be verified from a source-only ZIP.
