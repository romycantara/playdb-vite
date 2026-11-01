# PlayDB Vite 1.0.0

- **npm package:** `playdb-vite@1.0.0`
- **Released:** 2026-11-01
- **Development source:** [`packages/playdb-vite`](../../packages/playdb-vite)
- **Supported frameworks:** PlayLite (PHP), PlayGoLite (Go)
- **Requirements:** Node.js 18+, Vite 5 or 6
- **License:** MIT

## Contents

This directory is an immutable snapshot of the npm package:

- `package.json`
- `dist/` (`index.js`, `index.d.ts`, `server-index.html`)
- `bin/clean.js` (`playdb-vite-clean`)
- `inertia-helpers/index.js`
- `README.md`
- `LICENSE`

Release metadata lives next to the package files:

- `VERSION`
- `RELEASE.md`
- `SHA256SUMS`

## Notes

- First stable public release under the PlayDB name.
- Includes the redesigned `dist/server-index.html` development shell.
- `import.meta.dirname` was replaced with `process.cwd()` for Node 18 and
  pnpm compatibility.
- Publish with:

  ```bash
  cd playlite_engine/PlayDB-Vite-1.0.0
  npm publish
  ```

Verify the package contents with `npm pack --dry-run` before publishing.
