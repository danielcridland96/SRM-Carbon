import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  build: {
    // Warn (but don't fail) if a chunk exceeds 600 kB after gzip
    chunkSizeWarningLimit: 600,

    // No source maps in production — avoids leaking source code via the CDN.
    // To debug a production issue, build locally with `vite build --sourcemap`.
    sourcemap: false,

    rollupOptions: {
      output: {
        /**
         * Manual chunk splitting — separates vendor libraries from app code.
         *
         * Why this matters for production:
         * Vite appends a content hash to each chunk filename (e.g. vendor-react-BXk9mAFp.js).
         * When only app code changes, the vendor chunks keep the same hash and stay
         * cached in the browser / CDN — visitors don't re-download React on every deploy.
         *
         * Three vendor chunks:
         *   vendor-react     — React + React DOM + React Router (largest, changes rarely)
         *   vendor-supabase  — Supabase client (changes on SDK upgrades only)
         *   vendor-emailjs   — EmailJS browser client
         */
        manualChunks: {
          'vendor-react':    ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-emailjs':  ['@emailjs/browser'],
        },
      },
    },
  },
});
