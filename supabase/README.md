# Local Supabase schema preparation

No remote connection, administrator/service key, database password, or deployment is required by these files. The migration runs once, atomically (`BEGIN` / `COMMIT`), on a Supabase PostgreSQL database containing `auth` and `storage`. It is not an application wiring change.

## Cloud setup

คำแนะนำภาษาไทยสำหรับ SQL Editor และ OAuth อยู่ที่ [SETUP.md](SETUP.md) Migration ถูก apply บนโปรเจกต์ cloud `cjrzxvpdayjxopwjbjer` ผ่าน MCP แล้ว (versions ตรงกับชื่อไฟล์); ห้ามรันซ้ำบนโปรเจกต์นี้ และห้ามรัน fixtures จาก `tests/rls.sql` บน production

### Member signup and Auth deployment contract

Migration `20261017001204_member_usernames.sql` was applied remotely to project `cjrzxvpdayjxopwjbjer`; security advisors returned no findings. Do not reapply it. Public Auth settings reported by that verification: `email=true`, `disable_signup=false`, `mailer_autoconfirm=false`, `google=false`, `facebook=false`. Email signup is enabled and confirmation is required; Google/Facebook still need Dashboard configuration. **Never disable email confirmation.**

- Email signup collects Email, Password, and Username. The profile trigger reads user-metadata username only for trusted app-metadata provider `email`, normalizes it with trim/lower, and defaults display `name` to username when no name is supplied.
- Username is nullable for existing/OAuth profiles; non-null values must match `^[a-z0-9_]{3,24}$` and cannot be `admin`, `administrator`, `root`, `support`, `system`, or `elephantmaker`. A database unique constraint protects concurrent claims. Owners may claim once; the validation trigger prevents subsequent changes/clearing for every role. Display name remains editable.
- Google first visits without a username go to `/account/setup` to claim one. Public profiles use `/u/username`, never an Auth email address. The app routes enforce this setup flow after email and OAuth sign-in.
- Configure production custom SMTP in the Dashboard: default delivery has limited volume/recipients. Keep SMTP/provider credentials only in the Dashboard or a secret manager. Recommend Dashboard minimum password length **8**, aligned with the UI; UI maximum is **128** characters. These password limits are recommendations/contracts, not verified current Dashboard values.
- Configure a Google Web OAuth client, consent screen/test users, and authorized JavaScript origins `http://localhost:3000` and `https://elephant-maker.vercel.app`. The exact Google authorized redirect URI is `https://cjrzxvpdayjxopwjbjer.supabase.co/auth/v1/callback`. Enter Client ID/Secret and enable Google only in the Supabase Dashboard; never expose secrets in browser environment variables or Git.
- Supabase production Site URL: `https://elephant-maker.vercel.app`. Allow `http://localhost:3000/auth/callback**` and `https://elephant-maker.vercel.app/auth/callback**` for app callbacks and their query strings. If token-hash templates are used, also allow the corresponding `/auth/confirm**` URLs. Use only necessary path-scoped patterns, not broad production-domain wildcards.
- Default signup email template uses `{{ .ConfirmationURL }}` with PKCE and an allowed app `/auth/callback` redirect. Open the confirmation in the same browser/profile as signup so the verifier is available. Google's Supabase `/auth/v1/callback` is distinct from the app's `/auth/callback`.
- Optional signup token-hash template link: `href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email"`. Recovery uses `type=recovery` and the confirm route sends the verified user to `/account/password`, with no `next` required. `.SiteURL` follows Dashboard Site URL; use a separate local/test project for local template testing. The app's `/auth/confirm` route uses a `verifyOtp` type allowlist (`email`, `signup`, `recovery`). Never log tokens.
- Password reset uses `resetPasswordForEmail` with `redirectTo` set to the app origin plus `/auth/callback?next=/account/password`; validate `next` as an allowed internal path. See [SETUP.md](SETUP.md) for Dashboard steps and acceptance checks. Documentation does not enable providers or implement these routes.

## In-memory validation

```sh
pnpm --package=@electric-sql/pglite --shell-mode dlx "node tests/schema-smoke.mjs"
```

Runs all migrations and SQL RLS tests, including preservation of existing profiles with null usernames and signup/claim constraints, in isolated PostgreSQL/PGlite with minimal Auth/Storage schemas, then verifies fixture rollback. This validates SQL/policies locally, not full Supabase Auth/Storage HTTP behavior.

## Local validation

Use a disposable **local Supabase** instance with Docker and the Supabase CLI. This repository does not include `supabase/config.toml`; initialize local configuration in a separate scratch directory, copy the migration and test there, and do not commit the scratch configuration here.

```sh
supabase init
# Copy all repository SQL migrations into the scratch supabase/migrations/.
supabase start
supabase db reset --local
# Use the local postgres connection reported by supabase status, never a remote URL.
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
```

The port above is the CLI default; use the actual local port if changed. Authentication is the local CLI instance's configuration, not a user's remote database password. SQL tests require the local administrative role only to create fixtures and switch roles. They impersonate `anon` / `authenticated` with transaction-local JWT claims, test expected SQLSTATEs and zero-row filtered mutations, and roll back all fixtures. A failure exits nonzero and the connection's aborted transaction rolls back. The script must not run against production.

Regenerate types after applying locally, and review differences before replacing the prepared type file:

```sh
supabase gen types typescript --local --schema public
```

The supplied `src/lib/supabase/database.types.ts` is a schema-derived, hand-prepared Supabase `Database` type, not the existing mock `Database` array model. It includes Row/Insert/Update/Relationships and is used by browser/server/proxy client helper generics. Regenerate it after applying the actual schema.

## Exact schema contract

All identifiers are UUIDs. All ten public tables have RLS enabled.

| Table               | Columns / relationships                                                                                                                                                                                                                                                                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`          | `id` → `auth.users` (cascade), nullable unique `username` (validated lowercase, immutable after claim), `name`, `bio`, `avatar`, allowlisted `contacts` JSON (`line`, `facebook`, `github` string values), `created_at`, `updated_at`. No email, token, role, or admin columns.                                                                                                                                                                |
| `projects`          | `id`, unique `slug`, `title`, `summary`, `category`, `cover`, optional `compatibility_notes` (default `''`), optional allowlisted `contacts` JSON (default `{}`, `line`/`facebook`/`github` strings), `owner_id` → profiles, `status`, `readiness`, `budget`, `duration_minutes`, `difficulty`, `skills[]`, `safety_notes[]`, `published_at`, `featured`, timestamps. |
| `steps`             | `id`, `project_id`, positive `order` unique per project, optional `title` and `description` (both default `''`), nullable `safety_note`; unique (`id`, `project_id`). Only `project_id` and `order` are required on insert.                                                                                                                                           |
| `step_files`        | `project_id`, `step_id`, `file_id`; PK (`step_id`, `file_id`), positive `position` default 1 unique per step, `caption` default `''` (≤2000 characters). Composite FKs (`step_id`, `project_id`) → steps and (`file_id`, `project_id`) → files prevent cross-project attachments; same child RLS/grants.                                                              |
| `materials`         | `id`, `project_id`, `name`, nonnegative `quantity`, `unit`, nonnegative `estimated_cost`, nullable `note`.                                                                                                                                                                                                                                                            |
| `files`             | `id`, `project_id`, `name`, `kind`, nullable unique `storage_path`, `mime_type`, nullable `size_bytes`, `license`, nullable 64-hex `sha256`, `is_demo`. **No `url` column**.                                                                                                                                                                                          |
| `firmware_releases` | `id`, `project_id`, `version` unique per project, `chip`, `board`, `license`, `notes`, `is_demo`.                                                                                                                                                                                                                                                                     |
| `firmware_parts`    | `id`, **`project_id`**, `release_id`, `file_id`, `offset` (`0x` plus 1–8 hex digits), unique release/offset plus a numeric-normalized unique index so `0x1000` and `0x01000` cannot duplicate an address. Composite FKs bind both release and file to the same project.                                                                                               |
| `tags`              | `id`, unique `name`, unique `slug`; four seeded category tags.                                                                                                                                                                                                                                                                                                        |
| `project_tags`      | Composite PK (`project_id`, `tag_id`), cascading FKs.                                                                                                                                                                                                                                                                                                                 |

`category`: `ยานยนต์`, `บ้านและสวน`, `งานพิมพ์ 3D`, `อิเล็กทรอนิกส์`. `status`: `draft` / `published`. `readiness`: `showcase` / `ready`. `difficulty`: `beginner` / `intermediate` / `advanced`. File `kind`: `image` / `video` / `text` / `document` / `model` / `source` / `firmware`. File metadata size limits: 50 MiB (52,428,800 bytes) for non-firmware, 16 MiB (16,777,216 bytes) for firmware. Defaults and constraints are authoritative in the migration.

## Authorization and publication

- Anon sees published projects and their children. Owners additionally see their drafts and can mutate only their own projects/children. Updates check **both old and new parents**; parent reassignment cannot escape ownership.
- Profiles are publicly readable, including contacts. Owners may update only `username` (null → valid username once), `name`, `bio`, `avatar`, `contacts`; clients cannot insert/delete profiles. Put only intentionally public contact information here. JSON keys are allowlisted, but no database can recognize an email/token hidden inside an otherwise allowed string.
- Tags are globally readable; members have no tag mutation grants. Owners can attach/detach existing tags.
- `featured` defaults false and is excluded from authenticated INSERT/UPDATE column grants. Trusted database administrators can curate it; no client moderation/admin fields exist. Future broad table grants would invalidate this protection and must not be added.
- The original backfill takes only name/avatar metadata; the additive username migration does not backfill usernames. The auth insert trigger additionally reads username only for trusted email-provider signups, never OAuth. Names have control characters removed and are truncated to 100 characters; avatars must be bounded HTTPS strings. No untrusted role metadata is used. Avatar checks validate syntax, not destination trust; render safely and do not server-fetch arbitrary avatars without SSRF defenses.
- Only profile provisioning uses `SECURITY DEFINER`, with an empty fixed search path and revoked callable privileges. RLS policies and validation/timestamp triggers do not use bypass helpers.
- Publication requires nonblank title/summary/cover and licenses on every attached file. `ready` publication additionally requires at least one step, and every step must have a nonblank description or at least one `step_files` attachment. Titles may be empty; text-only and file-only steps are supported. Materials, compatibility notes, contacts, and device models are not required. `published_at` is set on publication and cleared on draft. This is **transition-time validation**, not continuous completeness: later deletion/reparenting of steps/step attachments can make a ready project incomplete. Concurrent child edits can also race the validation. Enforce workflow/locking before treating readiness as a certification. Published file inserts/updates independently require a license.

## Private storage and remaining risks

`project-assets` is private with a 50 MiB object limit and an allowlist for common images, binary, STL, ZIP, PDF, text, JSON, `video/mp4`, `video/webm`, `video/quicktime`, and `text/markdown`. Firmware metadata remains capped at 16 MiB; the bucket-wide limit alone does not enforce that narrower limit. The actual upload UI is not connected. Storage writes require authentication and an existing owned database project at `userId/projectId/nonempty-filename[/...]`. UUID matching is done by canonical text comparison (no unsafe UUID cast). Dot-path traversal is rejected. File attachment paths must match the project's owner/project; display `files.name` need not match the object's basename.

Storage SELECT permits published project assets or an owner's draft assets. Authorized users can request short-lived signed URLs through the Storage API; never persist those URLs in `files` and never make the bucket public. A signed URL is a bearer capability and may remain usable until expiration after unpublication/deletion: use short TTLs. Every object under a published project's valid path is readable, even without a `files` row; do not upload private extras beneath published projects.

Storage RLS and SQL attachment validation do **not** prove object existence, MIME/content authenticity, size/hash integrity, virus safety, firmware compatibility, or that an attachment references a `firmware` kind. Verify actual bytes/checksums and sanitize uploads in a trusted pipeline. SQL metadata tests do not exercise HTTP upload size/MIME enforcement or signed URL issuance; add local Storage API integration tests for those. Project/account cascades delete relational rows, **not storage objects**: schedule trusted orphan cleanup. No firmware is flashed or executed.

Existing Supabase installations may have other permissive Storage policies (policies combine with OR); audit them before deployment. Service-role keys bypass RLS and must never reach browsers or this repository. These files do not create or expose any service-role credentials, and do not change Supabase's built-in Storage grants.
