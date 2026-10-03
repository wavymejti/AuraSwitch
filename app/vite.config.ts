import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// web3.js and the Anchor client expect Node's Buffer/process globals.
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({ globals: { Buffer: true, process: true, global: true } }),
  ],
});
