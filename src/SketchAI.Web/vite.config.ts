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
        build: {
            rollupOptions: {
                output: {
                    manualChunks(id: string) {
                        // Vendor chunks - split large dependencies
                        if (id.includes('node_modules')) {
                            if (id.includes('react-dom') || id.includes('react/')) {
                                return 'vendor-react';
                            }
                            if (id.includes('@microsoft/signalr')) {
                                return 'vendor-signalr';
                            }
                            if (id.includes('framer-motion')) {
                                return 'vendor-motion';
                            }
                            if (id.includes('@radix-ui')) {
                                return 'vendor-radix';
                            }
                            if (id.includes('zustand') || id.includes('clsx') || 
                                id.includes('tailwind-merge') || id.includes('class-variance-authority')) {
                                return 'vendor-utils';
                            }
                        }
                    }
                }
            }
        },
        server: {
            port: parseInt(env.PORT) || 5173,
            proxy: {
                '/hubs/drawing': {
                    target: process.env['services__sketchai-api__https__0'] ||
                        process.env['services__sketchai-api__http__0'] ||
                        process.env.SKETCHAI_API_HTTPS ||
                        process.env.SKETCHAI_API_HTTP ||
                        'http://localhost:5000',
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
