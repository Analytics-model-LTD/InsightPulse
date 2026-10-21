import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import shellBridge from './shell-bridge/plugin.js';

export default defineConfig({
  plugins: [react(), shellBridge()],
});
