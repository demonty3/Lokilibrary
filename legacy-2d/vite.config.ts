import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // Default Vite port is 5173; pick a different one here so we don't fight
    // any other Vite project you have running. If 5183 is also taken, Vite
    // will auto-increment (5184, 5185, …) because strictPort is off.
    port: 5183,
    strictPort: false,
    host: true,
  },
});

