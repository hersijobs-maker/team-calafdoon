import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Older Android System WebViews cannot parse ES2020 syntax like
    // optional chaining (?.) or nullish coalescing (??); if any of it
    // survives minification the whole bundle fails with a SyntaxError
    // and the app shows nothing but a white screen. ES2018 keeps the
    // output parseable everywhere while staying fully functional.
    target: 'es2018',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
