import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4317",
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  build: {
    outDir: "../../public/panel-build",
    emptyOutDir: true,
    rolldownOptions: {
      input: {
        panel: new URL("./index.html", import.meta.url).pathname,
        contestOverlay: new URL("./contest-overlay.html", import.meta.url)
          .pathname,
        chatOverlay: new URL("./chat-overlay.html", import.meta.url).pathname,
      },
    },
  },
})
