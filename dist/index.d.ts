import type { PluginOption } from "vite";

type RefreshConfig = {
  paths: string[];
  config?: Record<string, unknown>;
};

export interface PlayDbViteConfig {
  input: string | string[];
  publicDirectory?: string;
  buildDirectory?: string;
  ssr?: string | string[];
  ssrOutputDirectory?: string;
  refresh?: boolean | string | string[] | RefreshConfig | RefreshConfig[];
  hotFile?: string;
  valetTls?: string | null;
  detectTls?: string | null;
  transformOnServe?: (code: string, devServerUrl?: string) => string;
}

export const refreshPaths: string[];

export default function playdb(config: PlayDbViteConfig): PluginOption[];
