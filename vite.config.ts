import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// Static browser edition: no Node/server polyfills in the client bundle.
export default defineConfig({
  plugins: [react()],
  build: { assetsDir: '_assets' },
});
