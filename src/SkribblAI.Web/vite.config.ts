import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    return {
        plugins: [
            react(),
            tailwindcss()
        ],
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src')
            }
        },
        server: {
            port: parseInt(env.PORT) || 5173,
            proxy: {
                '/hubs/drawing': {
                    target: process.env.APISERVICE_HTTPS ||
                        process.env.APISERVICE_HTTP,
                    changeOrigin: true,
                    secure: false,
                    ws: true,
                    headers: {
                        'X-Tunnel-Skip-AntiPhishing-Page': 'true'
                    }
                }
            }
        }
    }
})
