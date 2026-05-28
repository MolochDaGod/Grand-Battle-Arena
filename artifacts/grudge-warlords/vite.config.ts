import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const port = Number(process.env.PORT) || 5173;

export default defineConfig({
  base: "/",
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "three-core": ["three"],
          "r3f": ["@react-three/fiber", "@react-three/drei"],
        },
      },
    },
  },
  server: {
    port,
    strictPort: false,
    host: "0.0.0.0",
  },
  preview: {
    port,
    host: "0.0.0.0",
  },
});
