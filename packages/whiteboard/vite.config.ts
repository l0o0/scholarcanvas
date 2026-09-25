import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    target: "firefox115",
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      input: {
        whiteboard: fileURLToPath(new URL("./index.html", import.meta.url)),
        markdown: fileURLToPath(new URL("./markdown.html", import.meta.url)),
        editor: fileURLToPath(
          new URL("./markdown-editor.html", import.meta.url),
        ),
      },
    },
  },
});
