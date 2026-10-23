import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],
  // 开发预打包缓存也放到 D 盘，避免启动预览时重新累积源码盘缓存。
  cacheDir: "D:/SiaBuild/SiaWebUI/vite-cache/browser",
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
  build: {
    // 与 Tauri frontendDist 保持一致；目录仅保存本应用生成的前端产物。
    outDir: "D:/SiaBuild/SiaWebUI/frontend-dist/browser",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        menu: fileURLToPath(new URL("./menu.html", import.meta.url)),
        overlay: fileURLToPath(new URL("./overlay.html", import.meta.url)),
        tabPanel: fileURLToPath(new URL("./tab-panel.html", import.meta.url)),
      },
    },
  },
  server: {
    host: host || "127.0.0.1",
    port: 1440,
    strictPort: true,
    hmr: host ? { protocol: "ws", host, port: 1441 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  preview: { host: "127.0.0.1", port: 1440 },
});
