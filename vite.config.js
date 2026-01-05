import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
    base: '/',
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            injectRegister: 'inline', // Force injection of SW registration script
            manifest: {
                name: 'POS 2025 Smart System',
                short_name: 'POS 2025',
                description: 'ระบบจัดการร้านอาหารอัจฉริยะ',
                theme_color: '#0f172a',
                background_color: '#0f172a',
                display: 'standalone',
                start_url: '/index.html', // Use root path for web deployment
                icons: [
                    {
                        src: 'icon-512.png',
                        sizes: '192x192', // Android likes 192 too
                        type: 'image/png'
                    },
                    {
                        src: 'icon-512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any maskable'
                    }
                ]
            }
        })
    ],
    server: {
        port: 5173,
        strictPort: true,
        host: true, // Expose to network
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:3000',
                changeOrigin: true,
                secure: false
            }
        }
    }
})
