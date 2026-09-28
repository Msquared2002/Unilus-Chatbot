import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: "main.js",
      output: {
        entryFileNames: "chatbot-widget.js"
      }
    }
  }
});