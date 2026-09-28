import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      "monaco-editor/esm/vs/editor/editor.api": "monaco-editor/editor/editor.api",
      "monaco-editor/esm/vs/editor/common/commands/shiftCommand":
        "monaco-editor/editor/common/commands/shiftCommand",
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "monaco-editor/esm/vs/editor/editor.api": "monaco-editor/editor/editor.api",
      "monaco-editor/esm/vs/editor/common/commands/shiftCommand":
        "monaco-editor/editor/common/commands/shiftCommand",
    };
    return config;
  },
};

export default nextConfig;
