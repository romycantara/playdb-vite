# playdb-vite

Vite integration shared by **PlayLite (PHP)** and **PlayGoLite (Go)**.

The plugin wires Vite to the framework conventions: it loads `configs/vite.json`
from the project root when present, writes the dev-server URL to
`public/hot`, builds into `public/build` with a manifest, and serves the
development shell from the Go/PHP backend.

## Requirements

- Node.js 18 or newer
- Vite 5 or 6

## Install

```bash
npm install -D playdb-vite vite
```

## Usage

```ts
// vite.config.ts
import { defineConfig } from "vite";
import PlayDb from "playdb-vite";

export default defineConfig({
	plugins: [
		PlayDb({
			input: ["src/main.ts"],
			refresh: true,
		}),
	],
});
```

## Configuration

When `configs/vite.json` exists in the project root, the plugin reads:

| Key | Purpose |
| --- | --- |
| `viteHost`, `vitePort` | Dev server host and port |
| `viteDirKeySSL`, `viteDirCrtSSL` | TLS key/cert paths, relative to the project root |
| `viteRefreshPath` | Paths watched for a full reload |
| `assetUrl` | Public base for built assets, for example `/build/` |
| `publicBuildDirectory` | Public directory, default `public` |
| `buildDirectory` | Build subdirectory, for example `build` |
| `ssrOutputDirectory` | SSR output directory |
| `buildChunkSizeWarningLimit`, `buildTarget` | Build tuning |
| `viteDefAliases` | Optional alias map, default `{ "@": "src/js" }` |

The backend reads `public/hot` during development and
`public/build/manifest.json` in production. Stop the dev server with Ctrl+C to
remove the hot file.

## Clean orphaned assets

The package ships a small helper that compares the build manifest with the
generated asset directory:

```bash
npx playdb-vite-clean
npx playdb-vite-clean --dry-run
npx playdb-vite-clean --manifest=public/build/manifest.json
npx playdb-vite-clean --assets=public/build/assets
```

By default it reads `public/build/manifest.json`. `--dry-run` only reports the
orphaned files, and `--quiet` suppresses normal output.

## Notes

- `publicDir` is disabled by default so Vite does not copy the host project's
  public directory into itself.
- The dev server uses `strictPort` and the host/port from the configuration
  above unless overridden in `vite.config.ts`.
- TLS files are read from the project root, not from `node_modules`.
- `./inertia-helpers` exposes a small `resolvePageComponent` helper used by
  Inertia-style clients.

## License

MIT
