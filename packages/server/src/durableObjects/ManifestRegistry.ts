/**
 * Retired. This Durable Object used to store a copy of every game.json for the
 * web app to fetch; manifests are now bundled into the web build from
 * `packages/web/src/platform.games.ts`, and no route reaches this class.
 *
 * The class stays exported only because `wrangler.toml` still binds it and
 * declares it in a migration. Deleting it for good (and its stored copies)
 * takes a `deleted_classes` migration, which can't be rolled back — see
 * the follow-up in docs/plans/engine-platform-split.md.
 */
export class ManifestRegistry implements DurableObject {
  async fetch(): Promise<Response> {
    return new Response('ManifestRegistry is retired', {status: 410});
  }
}
