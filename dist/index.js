import fs from "fs";
import path from "path";
import colors from "picocolors";
import { fileURLToPath } from "url";
import { loadEnv } from "vite";
import fullReload from "vite-plugin-full-reload";

let exitHandlersBound = false;
let appConfig = playdbConfig();
let PlayRefreshPath = appConfig?.viteRefreshPath ?? [
	"src/pages/**",
	"src/views/**",
	"routes/**",
];

// The Vite process runs from the application root for both PlayLite and
// PlayGoLite, so resolve cert paths and configs from the working directory.
const rootDir = process.cwd();
const refreshPaths = PlayRefreshPath.filter((path2) =>
	fs.existsSync(path2.replace(/\*\*$/, "")),
);
const assetUrl = appConfig.assetUrl ? appConfig.assetUrl : "/";
const publicDirectory = appConfig.publicBuildDirectory
	? appConfig.publicBuildDirectory
	: "public";
const buildDirectory = appConfig.buildDirectory ? appConfig.buildDirectory : "";
const ssrOutputDirectory = appConfig.ssrOutputDirectory
	? appConfig.ssrOutputDirectory
	: "bootstrap/ssr";
const buildTarget = appConfig.buildTarget ? appConfig.buildTarget : "";
const buildChunkSizeWarningLimit = appConfig.buildChunkSizeWarningLimit
	? appConfig.buildChunkSizeWarningLimit
	: 5000;

function playdb(config) {
	const pluginConfig = resolvePluginConfig(config);
	return [
		resolvePlayDbPlugin(pluginConfig),
		...resolveFullReloadConfig(pluginConfig),
	];
}

function playdbConfig() {
	let playpath = path.resolve(process.cwd(), "configs");
	const envFile = path.resolve(playpath, "vite.json");

	if (fs.existsSync(envFile)) {
		try {
			return JSON.parse(fs.readFileSync(envFile, "utf-8"));
		} catch {
			return "";
		}
	}

	return "";
}

function resolvePlayDbPlugin(pluginConfig) {
	let viteDevServerUrl;
	let resolvedConfig;
	let userConfig;

	const defaultAliases = appConfig?.viteDefAliases ?? { "@": "src/js" };

	return {
		name: "playdb",
		enforce: "post",
		config: (config, { command, mode }) => {
			userConfig = config;
			const ssr = !!userConfig.build?.ssr;
			const env = loadEnv(mode, process.cwd(), "");
			const serverConfig = command === "serve" ?? void 0;
			const httpsKeySSL =
				(userConfig.server?.key ?? appConfig.viteDirKeySSL)
					? appConfig.viteDirKeySSL
					: "";
			const httpsCrtSSL =
				(userConfig.server?.cert ?? appConfig.viteDirCrtSSL)
					? appConfig.viteDirCrtSSL
					: "";
			const serverHttps =
				fs.existsSync(httpsKeySSL) && fs.existsSync(httpsCrtSSL)
					? {
							key: fs.readFileSync(
								path.resolve(rootDir, httpsKeySSL),
							),
							cert: fs.readFileSync(
								path.resolve(rootDir, httpsCrtSSL),
							),
						}
					: void 0;

			return {
				base:
					userConfig?.base ??
					(command === "build"
						? resolveBase(pluginConfig, assetUrl)
						: ""),
				publicDir: userConfig?.publicDir ?? false,
				build: {
					manifest:
						userConfig.build?.manifest ??
						(ssr ? false : "manifest.json"),
					ssrManifest:
						userConfig.build?.ssrManifest ??
						(ssr ? "ssr-manifest.json" : false),
					chunkSizeWarningLimit:
						userConfig.build?.chunkSizeWarningLimit ??
						buildChunkSizeWarningLimit,
					outDir:
						userConfig.build?.outDir ??
						resolveOutDir(pluginConfig, ssr),
					rollupOptions: {
						input:
							userConfig.build?.rollupOptions?.input ??
							resolveInput(pluginConfig, ssr),
					},
					assetsInlineLimit: userConfig.build?.assetsInlineLimit ?? 0,
					target: userConfig.build?.target ?? buildTarget,
				},
				server: {
					host:
						userConfig.server?.host ??
						appConfig?.viteHost ??
						"0.0.0.0",
					port:
						userConfig.server?.port ??
						parseInt(appConfig?.vitePort ?? 5173),
					strictPort: userConfig.server?.strictPort ?? true,
					https: userConfig.server?.https ?? serverHttps,
					origin: userConfig.server?.origin ?? "__vite_placeholder__",
					...(serverConfig
						? {
								host:
									userConfig.server?.host ??
									serverConfig.host,
								hmr:
									userConfig.server?.hmr === false
										? false
										: {
												...serverConfig.hmr,
												...(userConfig.server?.hmr ===
												true
													? {}
													: userConfig.server?.hmr),
											},
							}
						: void 0),
				},
				resolve: {
					alias: Array.isArray(userConfig.resolve?.alias)
						? [
								...(userConfig.resolve?.alias ?? []),
								...Object.keys(defaultAliases).map((alias) => ({
									find: alias,
									replacement: defaultAliases[alias],
								})),
							]
						: {
								...defaultAliases,
								...userConfig.resolve?.alias,
							},
				},
				ssr: {
					noExternal: noExternalInertiaHelpers(userConfig),
				},
			};
		},
		configResolved(config) {
			resolvedConfig = config;
		},
		transform(code) {
			if (resolvedConfig.command === "serve") {
				code = code.replace(/__vite_placeholder__/g, viteDevServerUrl);
				return pluginConfig.transformOnServe(code, viteDevServerUrl);
			}
		},
		configureServer(server) {
			const envDir = resolvedConfig.envDir || process.cwd();
			const appUrl = appConfig?.viteHost ?? "undefined";

			server.httpServer?.once("listening", () => {
				const address = server.httpServer?.address();
				const isAddressInfo = (x) => typeof x === "object";
				if (isAddressInfo(address)) {
					viteDevServerUrl = userConfig.server?.origin
						? userConfig.server.origin
						: resolveDevServerUrl(
								address,
								server.config,
								userConfig,
							);
					fs.writeFileSync(
						pluginConfig.hotFile,
						`${viteDevServerUrl}${server.config.base.replace(/\/$/, "")}`,
					);
					setTimeout(() => {
						server.config.logger.info(
							` ${colors.red(colors.bold("PLAYDB"))}  ${colors.dim("plugin")} ${colors.bold(`v${pluginVersion()}`)}`,
						);
						server.config.logger.info("");
					}, 100);
				}
			});
			if (!exitHandlersBound) {
				const clean = () => {
					if (fs.existsSync(pluginConfig.hotFile)) {
						fs.rmSync(pluginConfig.hotFile);
					}
				};
				process.on("exit", clean);
				process.on("SIGINT", () => process.exit());
				process.on("SIGTERM", () => process.exit());
				process.on("SIGHUP", () => process.exit());
				exitHandlersBound = true;
			}
			return () =>
				server.middlewares.use((req, res, next) => {
					if (req.url === "/index.html") {
						res.statusCode = 404;
						res.end(
							fs
								.readFileSync(
									path.join(dirname(), "server-index.html"),
								)
								.toString()
								.replace(/{{ APP_URL }}/g, appUrl),
						);
					}
					next();
				});
		},
	};
}

function pluginVersion() {
	try {
		return JSON.parse(
			fs.readFileSync(path.join(dirname(), "../package.json")).toString(),
		)?.version;
	} catch {
		return "";
	}
}

function resolvePluginConfig(config) {
	if (typeof config === "undefined") {
		throw new Error("playdb-vite: missing configuration.");
	}
	if (typeof config === "string" || Array.isArray(config)) {
		config = { input: config, ssr: config };
	}
	if (typeof config.input === "undefined") {
		throw new Error(
			'playdb-vite: missing configuration for "input".',
		);
	}
	if (typeof config.publicDirectory === "string") {
		config.publicDirectory = config.publicDirectory
			.trim()
			.replace(/^\/+/, "");
		if (config.publicDirectory === "") {
			throw new Error(
				"playdb-vite: publicDirectory must be a subdirectory. E.g. 'public'.",
			);
		}
	}
	if (typeof config.buildDirectory === "string") {
		config.buildDirectory = config.buildDirectory
			.trim()
			.replace(/^\/+/, "")
			.replace(/\/+$/, "");
		if (config.buildDirectory === "") {
			throw new Error(
				"playdb-vite: buildDirectory must be a subdirectory. E.g. 'build'.",
			);
		}
	}
	if (typeof config.ssrOutputDirectory === "string") {
		config.ssrOutputDirectory = config.ssrOutputDirectory
			.trim()
			.replace(/^\/+/, "")
			.replace(/\/+$/, "");
	}
	if (config.refresh === true) {
		config.refresh = [{ paths: refreshPaths }];
	}

	return {
		input: config.input,
		publicDirectory: config.publicDirectory ?? publicDirectory,
		buildDirectory: config.buildDirectory ?? buildDirectory,
		ssr: config.ssr ?? config.input,
		ssrOutputDirectory: config.ssrOutputDirectory ?? ssrOutputDirectory,
		refresh: config.refresh ?? false,
		hotFile:
			config.hotFile ??
			path.join(config.publicDirectory ?? "public", "hot"),
		valetTls: config.valetTls ?? null,
		detectTls: config.detectTls ?? config.valetTls ?? null,
		transformOnServe: config.transformOnServe ?? ((code) => code),
	};
}

function resolveBase(config, assetUrl) {
	return config.buildDirectory
		? assetUrl +
				(!assetUrl.endsWith("/") ? "/" : "") +
				config.buildDirectory +
				"/"
		: assetUrl + (!assetUrl.endsWith("/") ? "/" : "");
}

function resolveInput(config, ssr) {
	if (ssr) {
		return config.ssr;
	}
	return config.input;
}

function resolveOutDir(config, ssr) {
	if (ssr) {
		return config.ssrOutputDirectory;
	}
	return path.join(config.publicDirectory, config.buildDirectory);
}

function resolveFullReloadConfig({ refresh: config }) {
	if (typeof config === "boolean") {
		return [];
	}
	if (typeof config === "string") {
		config = [{ paths: [config] }];
	}
	if (!Array.isArray(config)) {
		config = [config];
	}
	if (config.some((c) => typeof c === "string")) {
		config = [{ paths: config }];
	}
	return config.flatMap((c) => {
		const plugin = fullReload(c.paths, c.config);
		plugin.__playdb_config = c;
		return plugin;
	});
}

function resolveDevServerUrl(address, config, userConfig) {
	const configHmrProtocol =
		typeof config.server.hmr === "object"
			? config.server.hmr.protocol
			: null;
	const clientProtocol = configHmrProtocol
		? configHmrProtocol === "wss"
			? "https"
			: "http"
		: null;
	const serverProtocol = config.server.https ? "https" : "http";
	const protocol = clientProtocol ?? serverProtocol;
	const configHmrHost =
		typeof config.server.hmr === "object" ? config.server.hmr.host : null;
	const configHost =
		typeof config.server.host === "string" ? config.server.host : null;
	const serverAddress = isIpv6(address)
		? `[${address.address}]`
		: address.address;
	const host = configHmrHost ?? configHost ?? serverAddress;
	const configHmrClientPort =
		typeof config.server.hmr === "object"
			? config.server.hmr.clientPort
			: null;
	const port = configHmrClientPort ?? address.port;
	return `${protocol}://${host}:${port}`;
}

function isIpv6(address) {
	return address.family === "IPv6" || address.family === 6;
}

function noExternalInertiaHelpers(config) {
	const userNoExternal = config.ssr?.noExternal;
	const pluginNoExternal = ["playdb-vite"];
	if (userNoExternal === true) {
		return true;
	}
	if (typeof userNoExternal === "undefined") {
		return pluginNoExternal;
	}
	return [
		...(Array.isArray(userNoExternal) ? userNoExternal : [userNoExternal]),
		...pluginNoExternal,
	];
}

function dirname() {
	return fileURLToPath(new URL(".", import.meta.url));
}

export { playdb as default, refreshPaths };
