import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const isWebBuild = process.env.VITE_BUILD_TARGET === "web";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // In web build mode, replace Tauri modules with lightweight shims
      ...(isWebBuild
        ? {
            "@tauri-apps/api/core": path.resolve(__dirname, "./src/lib/shims/tauri-core.ts"),
            "@tauri-apps/api/event": path.resolve(__dirname, "./src/lib/shims/tauri-event.ts"),
            "@tauri-apps/api/app": path.resolve(__dirname, "./src/lib/shims/tauri-app.ts"),
            "@tauri-apps/api/webviewWindow": path.resolve(__dirname, "./src/lib/shims/tauri-webview-window.ts"),
            "@tauri-apps/plugin-dialog": path.resolve(__dirname, "./src/lib/shims/tauri-dialog.ts"),
            "@tauri-apps/plugin-updater": path.resolve(__dirname, "./src/lib/shims/tauri-updater.ts"),
            "@tauri-apps/plugin-process": path.resolve(__dirname, "./src/lib/shims/tauri-process.ts"),
            "@tauri-apps/plugin-shell": path.resolve(__dirname, "./src/lib/shims/tauri-core.ts"),
          }
        : {}),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    // In web dev mode, proxy API calls to the Python backend
    ...(isWebBuild
      ? {
          proxy: {
            "/api": "http://localhost:8080",
            "/health": "http://localhost:8080",
          },
        }
      : {}),
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    outDir: isWebBuild ? "dist" : undefined,
  },
});
