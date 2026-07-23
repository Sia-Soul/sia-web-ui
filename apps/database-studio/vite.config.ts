import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: "@sia-ui/react/styles.css",
        replacement: fileURLToPath(new URL("../../packages/react/src/styles.css", import.meta.url)),
      },
      {
        find: /^@sia-ui\/react$/,
        replacement: fileURLToPath(new URL("../../packages/react/src/index.ts", import.meta.url)),
      },
    ],
  },
  clearScreen: false,
  server: {
    host: host || "127.0.0.1",
    port: 1430,
    strictPort: true,
    hmr: host ? { protocol: "ws", host, port: 1431 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  preview: { host: "127.0.0.1", port: 1430 },
});
