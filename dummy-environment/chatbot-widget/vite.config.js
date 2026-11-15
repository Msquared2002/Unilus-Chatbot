import { defineConfig } from "vite";

export default defineConfig({
  // Lets a Netlify environment variable VITE_API_BASE (e.g. https://my-backend.example.com/api) set the backend address
  // at build time. See chatbot-widget/config.js. Empty means "decide in the browser".
  define: {
    __UNILUS_API_BASE__: JSON.stringify(process.env.VITE_API_BASE || "")
  },
  build: {
    rollupOptions: {
      input: "main.js",
      output: {
        entryFileNames: "chatbot-widget.js"
      }
    }
  }
});