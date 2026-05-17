import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5183,
    host: true,
    strictPort: false,
    // Same-origin /api in dev so the session cookie (HttpOnly, SameSite=Lax)
    // works without cross-origin gymnastics. Production gets the same shape via
    // a single domain or a Workers route in front of Pages.
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
});
