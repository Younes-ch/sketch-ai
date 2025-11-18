import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    return {
        plugins: [react()],
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src')
            }
        },
        server: {
            port: parseInt(env.VITE_PORT) || 5173,
            proxy: {
                '/hubs/drawing': {
                    target: process.env.services__api__https__0 ||
                        process.env.services__api__http__0,
                    changeOrigin: true,
                    secure: false,
                    ws: true,
                }
            }
        }
    }
})
