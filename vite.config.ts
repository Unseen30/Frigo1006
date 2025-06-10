
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 4173,
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: false,
    allowedHosts: [
      'frigo1006.onrender.com',
      'localhost',
    ]
  },
  plugins: [
    react(),
    // Use the updated lovable-tagger in development mode
    mode === 'development' && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Ensure proper build for mobile
  build: {
    outDir: 'dist',
    minify: true,
    sourcemap: false,
    target: 'es2015',
    rollupOptions: {
      external: [],
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          leaflet: ['leaflet'],
          ui: ['@radix-ui/react-dialog']
        }
      }
    }
  },
  // Optimize dependencies for mobile
  optimizeDeps: {
    include: ['leaflet', 'react', 'react-dom']
  },
  // Define for better module resolution and mobile compatibility
  define: {
    global: 'globalThis',
    'process.env': {}
  }
}));
