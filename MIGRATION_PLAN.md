# Canvas: Finish AWS→Cloudflare Migration

You are picking this up mid-flight. All backend code and CI wiring is already written; AWS has been torn down. What remains is deploying the Worker, uploading manifests, wiring secrets, cutting over the frontend, and deleting the dead AWS packages.

## State when you start

**Done (do not redo):**
- New `packages/server/` package written: Worker + `GameRoom` DO + `ManifestRegistry` DO + `/rooms` and `/manifests` routes + `scripts/upload-manifests.mjs`.
- Frontend rewired to use `VITE_API_URL` for both `/rooms` and `/manifests` (`packages/web/src/registry/games.ts`, `vite-env.d.ts`, `.env.example`, `vite.config.ts` with dev proxy).
- `.github/workflows/deploy.yml` rewritten with `deploy-server` job (wrangler-action) that runs before `deploy-pages`.
- `pnpm install` completed cleanly. Typecheck passes across the workspace.
- AWS stack destroyed: `cdk destroy CanvasStack` finished successfully. Lambdas, API Gateway (HTTP + WS), DynamoDB `RoomTable`, S3 `ManifestsBucket` — all gone.

**Current git state** (uncommitted):
```
M .github/workflows/deploy.yml
M package.json
M packages/web/.env.example
M packages/web/src/registry/games.ts
M packages/web/src/vite-env.d.ts
M packages/web/vite.config.ts
M pnpm-lock.yaml
?? packages/server/
```

**Still on disk but dead code:** `packages/infra/` and `packages/handlers/` — the AWS resources they defined no longer exist.

**Live site status:** canvas-bdg.pages.dev is currently broken (manifest fetches 404 because the S3 bucket is gone). Restoring service is the goal of this plan.

## The user must do these three things (you cannot)

These require interactive browser auth or the GitHub web UI. Before starting, tell the user which are done — do not attempt them yourself.

1. **`wrangler login`** — opens a browser. Run from `packages/server/`:
   ```bash
   cd packages/server && pnpm exec wrangler login
   ```
2. **Set the Worker secret** — interactive prompt:
   ```bash
   cd packages/server && pnpm exec wrangler secret put MANIFEST_ADMIN_TOKEN
   ```
   Any random string (e.g. `openssl rand -hex 32`). The user must save this value; step 3 and later steps reuse it.
3. **Add GitHub Actions secrets** at github.com → repo → Settings → Secrets and variables → Actions:
   - `SERVER_URL` = the Worker URL from step below (e.g. `https://canvas-server.<account>.workers.dev`)
   - `MANIFEST_ADMIN_TOKEN` = same value as (2)

`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` already exist in GitHub secrets (Pages deploy uses them). Confirm the API token has `Account / Workers Scripts / Edit` scope — Pages-only tokens will fail Worker deploy.

## Steps you should execute (in order)

Ask the user to confirm steps 1–3 above are done before proceeding.

### 1. Deploy the Worker
```bash
pnpm --filter @canvas/server deploy
```
Capture the printed URL (`https://canvas-server.<account>.workers.dev`). If deploy fails with "Workers Paid required" or a DO binding error, stop and tell the user to enable Workers Paid ($5/mo) at Cloudflare dashboard → Workers & Pages → Plans.

### 2. Verify the Worker is live
```bash
curl -s https://canvas-server.<account>.workers.dev/health
```
Expect 200. Then:
```bash
curl -s https://canvas-server.<account>.workers.dev/manifests/index.json
```
Expect `[]` (empty — no manifests uploaded yet). If you get a Cloudflare error page instead, stop.

### 3. Upload manifests
```bash
SERVER_URL=https://canvas-server.<account>.workers.dev \
MANIFEST_ADMIN_TOKEN=<same value user set in step 2 of manual steps> \
node packages/server/scripts/upload-manifests.mjs
```
Verify:
```bash
curl -s $SERVER_URL/manifests/index.json | jq length
```
Should print `5` (snake, solitaire, sudoku, blackjack, poker).

### 4. Update `packages/web/.env.local`
If a `.env.local` exists, edit it to `VITE_API_URL=https://canvas-server.<account>.workers.dev`. If it doesn't exist, create it with that single line. This is only used for the user's local dev — production reads from `SERVER_URL` GitHub secret. Do NOT commit `.env.local`.

### 5. Delete dead AWS packages
```bash
rm -rf packages/infra packages/handlers
pnpm install
```
`pnpm install` regenerates the lockfile without the AWS workspaces. Then verify the workspace still typechecks:
```bash
pnpm -r typecheck
```

### 6. Commit and push
Two commits — one for the migration, one for the AWS deletions. Or one single "AWS→Cloudflare migration" commit if you prefer; user has not stated a preference. Suggested:
```bash
git add packages/server packages/web .github/workflows/deploy.yml package.json pnpm-lock.yaml
git commit -m "feat: migrate backend from AWS to Cloudflare Workers + Durable Objects

- New @canvas/server package: Worker + GameRoom DO (WebSocket Hibernation) +
  ManifestRegistry DO (replaces S3 manifests bucket)
- Rewire frontend to VITE_API_URL for both /rooms and /manifests
- Split deploy workflow into deploy-server (wrangler-action) → deploy-pages
- Vite dev proxy for /rooms (ws:true) and /manifests to local wrangler dev

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"

git add -u packages/infra packages/handlers pnpm-lock.yaml
git commit -m "chore: remove packages/infra and packages/handlers after AWS teardown

CanvasStack destroyed via cdk destroy. Lambdas, API Gateway (HTTP + WS),
DynamoDB RoomTable, and S3 ManifestsBucket no longer exist.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"

git push origin main
```

Pushing to `main` triggers `.github/workflows/deploy.yml`. First `deploy-server` runs (re-deploys the Worker + re-uploads manifests — idempotent), then `deploy-pages` builds the frontend with `VITE_API_URL=${{ secrets.SERVER_URL }}` and deploys to Pages.

### 7. Smoke test production
Watch the GitHub Actions run to green. Then:
```bash
curl -s https://canvas-bdg.pages.dev/ -o /dev/null -w "%{http_code}\n"   # 200
curl -s https://canvas-server.<account>.workers.dev/manifests/index.json | jq length   # 5
```

Ask the user to open canvas-bdg.pages.dev in a browser and confirm:
- Lobby loads and lists the 5 games
- Poker: create a room, join with two browsers, start a hand, play through, close/reopen one tab to verify reconnect-by-name works

If any of that fails, `wrangler tail` from `packages/server/` streams the Worker logs live for debugging.

## Constraints & gotchas

- **Do not amend commits** — this repo's convention is new commits per fix.
- **Do not commit `.env.local`** or the `MANIFEST_ADMIN_TOKEN` value in any form.
- **Do not force-push.**
- **Do not skip hooks** (`--no-verify`) — investigate failures instead.
- If `pnpm --filter @canvas/server deploy` errors on `workerd` postinstall, that's a known WSL2 glibc issue on the user's machine but should not occur in CI or on the wrangler cloud deploy path — the deploy uploads the bundle, it doesn't run workerd locally.
- The `MEMORY.md` file at `/home/esemella/.claude/projects/-home-esemella-canvas/memory/MEMORY.md` still references `packages/infra` and `packages/handlers`. After step 5 succeeds, update those lines to reflect the new architecture (or delete them). There's also an `Active Plans` entry pointing at `aws-to-cloudflare-migration-plan.md` — mark it complete or remove.

## Success criteria

- `pnpm -r typecheck` clean.
- `curl https://canvas-server.../manifests/index.json` returns 5 entries.
- canvas-bdg.pages.dev loads and a full poker hand can be played between two clients.
- `packages/infra/` and `packages/handlers/` deleted; lockfile regenerated.
- Migration committed and pushed to `main`; CI green.
