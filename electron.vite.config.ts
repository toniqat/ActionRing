import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('shared')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('shared')
      }
    },
    build: {
      rollupOptions: {
        input: {
          ring: resolve('src/preload/ring.ts'),
          settings: resolve('src/preload/settings.ts'),
          appearance: resolve('src/preload/appearance.ts'),
          shortcuts: resolve('src/preload/shortcuts.ts'),
          progress: resolve('src/preload/progress.ts')
        }
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@ring': resolve('src/renderer/ring/src'),
        '@settings': resolve('src/renderer/settings/src'),
        '@shared': resolve('shared'),
        '@shortcuts': resolve('src/renderer/shortcuts/src'),
        '@progress': resolve('src/renderer/progress/src')
      }
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          ring: resolve('src/renderer/ring/index.html'),
          settings: resolve('src/renderer/settings/index.html'),
          appearance: resolve('src/renderer/appearance/index.html'),
          shortcuts: resolve('src/renderer/shortcuts/index.html'),
          progress: resolve('src/renderer/progress/index.html')
        }
      }
    }
  }
})
