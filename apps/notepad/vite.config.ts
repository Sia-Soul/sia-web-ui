import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: "@sia.soul/sia-react-ui/styles.css",
        replacement: fileURLToPath(new URL("../../packages/react/src/styles.css", import.meta.url)),
      },
      {
        find: /^@sia\.soul\/sia-react-ui$/,
        replacement: fileURLToPath(new URL("../../packages/react/src/index.ts", import.meta.url)),
      },
    ],
  },
  clearScreen: false,
  server: {
    host: host || "127.0.0.1",
    port: 1470,
    strictPort: true,
    hmr: host ? { protocol: "ws", host, port: 1471 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  preview: { host: "127.0.0.1", port: 1470 },
});
