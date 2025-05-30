/// <reference types="vitest" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { visualizer } from 'rollup-plugin-visualizer'
import { VitePWA } from 'vite-plugin-pwa'
// TODO: Phase 2 - Re-enable PurgeCSS
// import purgecss from 'vite-plugin-purgecss'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    visualizer({
      filename: 'dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
      template: 'treemap', // sunburst | treemap | network
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', '*.png', '*.svg'],
      manifest: {
        name: 'Chat Rooms Application',
        short_name: 'Chat Rooms',
        description: 'Real-time chat application with Vue 3, NestJS, MongoDB, and Socket.io',
        theme_color: '#4DBA87',
        icons: [
          {
            src: 'vite.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: 'vite.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        sourcemap: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          },
          {
            urlPattern: /^https:\/\/api\.yourdomain\.com\/api\/*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 12 // 12 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    }),
    // TODO: Phase 2 - Re-enable PurgeCSS for production builds
    // Add PurgeCSS for CSS optimization (disabled during development for faster builds)
    // process.env.NODE_ENV === 'production' ? purgecss({
    //   content: ['./src/**/*.vue', './src/**/*.ts', './index.html'],
    //   defaultExtractor: content => content.match(/[\w-/:]+(?<!:)/g) || [],
    //   safelist: {
    //     standard: [
    //       /-(leave|enter|appear)(|-(to|from|active))$/, // Vue transitions
    //       /^(?!cursor-move).+-move$/,
    //       /^router-link(|-exact)-active$/,
    //       /data-v-.*/,
    //     ],
    //     deep: [/^router-link/,/^v-/, /^vs-/, /^vue-/, /^pinia-/], // Router & framework classes
    //     greedy: [/transition/, /popover/], // These pattern matches can have side effects
    //   }
    // }) : false,
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    target: 'esnext',
    minify: 'terser',
    cssMinify: true,
    cssCodeSplit: true,
    sourcemap: process.env.NODE_ENV !== 'production',
    assetsInlineLimit: 4096, // 4kb - files smaller than this will be inlined as base64
    chunkSizeWarningLimit: 1000, // Increase the warning limit to 1000kb
    reportCompressedSize: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
          'ui-framework': ['bootstrap'],
          'ui-utils': ['@vueuse/core', '@vueuse/components'],
          'socket-io': ['socket.io-client'],
          'utils': ['lodash-es'],
          'monitoring': ['web-vitals', 'vue-web-vitals'],
          'image-processing': ['browser-image-compression', 'webp-converter'],
          'offline-support': ['workbox-window']
        },
        // Improved chunk naming strategy
        chunkFileNames: (chunkInfo) => {
          const id = chunkInfo.facadeModuleId || '';
          
          // Named chunks from manualChunks
          if (chunkInfo.name && !id.includes('node_modules')) {
            return 'assets/[name]-[hash].js';
          }
          
          // Dynamic imports by module path
          if (id && id.includes('/modules/')) {
            const moduleName = id.match(/\/modules\/([^/]+)/);
            if (moduleName && moduleName[1]) {
              return `assets/module-${moduleName[1]}-[hash].js`;
            }
          }
          
          // Vendor chunks
          if (id && id.includes('node_modules')) {
            const name = id.match(/node_modules\/(.+?)\//);
            if (name && name[1]) {
              return `assets/vendor-${name[1]}-[hash].js`;
            }
          }
          
          return 'assets/chunk-[hash].js';
        },
        // Improved asset naming
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name || '';
          
          // Group by file type
          if (info.endsWith('.css')) return 'assets/css/[name]-[hash][extname]';
          if (/\.(png|jpe?g|gif|svg|webp|avif)$/.test(info)) return 'assets/img/[name]-[hash][extname]';
          if (/\.(woff2?|eot|ttf|otf)$/.test(info)) return 'assets/fonts/[name]-[hash][extname]';
          
          return 'assets/[name]-[hash][extname]';
        }
      }
    },
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
        drop_debugger: process.env.NODE_ENV === 'production',
        pure_funcs: process.env.NODE_ENV === 'production' ? ['console.log'] : [],
        passes: 2, // Multiple passes for better minification
      },
      format: {
        comments: false
      }
    },
  },
  server: {
    port: 5174,
    host: true
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/__tests__/setup.ts'],
    exclude: [
      'tests/e2e/**',
      '**/node_modules/**',
      '**/dist/**',
      '**/*.d.ts'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'src/__tests__/',
        '**/*.spec.ts',
        '**/*.test.ts'
      ],
      thresholds: {
        lines: 85,
        branches: 80,
        functions: 75,
        statements: 85
      }
    },
    testTimeout: 10000,
    hookTimeout: 10000
  }
})
