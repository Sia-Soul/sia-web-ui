import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // 游戏示例与主入口一样读取工作区源码，避免本地开发依赖旧发布产物。
      { find: /^@sia\.soul\/sia-react-ui\/game$/, replacement: fileURLToPath(new URL("../../packages/react/src/game.ts", import.meta.url)) },
      { find: "@sia.soul/sia-react-ui/styles.css", replacement: fileURLToPath(new URL("../../packages/react/src/styles.css", import.meta.url)) },
      { find: /^@sia\.soul\/sia-react-ui$/, replacement: fileURLToPath(new URL("../../packages/react/src/index.ts", import.meta.url)) },
    ],
  },
  server: { port: 4173 },
  preview: { port: 4173 },
});
