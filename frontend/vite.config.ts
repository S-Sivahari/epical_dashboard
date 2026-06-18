import { copyFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Production builds inject the JS bundle before the main CSS chunk — reorder them. */
function cssBeforeJs(): Plugin {
  return {
    name: 'css-before-js',
    enforce: 'post',
    transformIndexHtml(html) {
      const bundleCss = html.match(/<link rel="stylesheet" crossorigin href="\/assets\/[^"]+">/)?.[0]
      const scriptTag = html.match(/<script type="module" crossorigin[^>]*><\/script>/)?.[0]
      if (!bundleCss || !scriptTag || html.indexOf(bundleCss) < html.indexOf(scriptTag)) {
        return html
      }
      return html
        .replace(bundleCss, '')
        .replace(scriptTag, '')
        .replace('</head>', `    ${bundleCss}\n    ${scriptTag}\n  </head>`)
    },
  }
}

/** Login styles must paint before JS — sync to public/ for an early <link> in index.html. */
function syncLoginCriticalCss(): Plugin {
  const src = path.resolve(__dirname, 'src/styles/login.css')
  const dest = path.resolve(__dirname, 'public/login-critical.css')
  return {
    name: 'sync-login-critical-css',
    buildStart() {
      copyFileSync(src, dest)
    },
    configureServer() {
      copyFileSync(src, dest)
    },
  }
}

export default defineConfig({
  plugins: [react(), syncLoginCriticalCss(), cssBeforeJs()],
  server: {
    port: 5173,
    strictPort: true,
    // Windows: avoid EBUSY when index.css is read during HMR (editor + Vite race)
    watch: {
      usePolling: true,
      interval: 300,
    },
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      sonner: path.resolve(__dirname, './src/lib/noop-sonner.ts'),
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@layouts': path.resolve(__dirname, './src/layouts'),
      '@routes': path.resolve(__dirname, './src/routes'),
      '@store': path.resolve(__dirname, './src/store'),
      '@services': path.resolve(__dirname, './src/services'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@constants': path.resolve(__dirname, './src/constants'),
      '@context': path.resolve(__dirname, './src/context'),
      '@assets': path.resolve(__dirname, './src/assets'),
    },
  },
})
