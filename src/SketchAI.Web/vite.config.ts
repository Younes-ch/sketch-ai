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
        // Expose specific environment variables to the client
        define: {
            'import.meta.env.VITE_TURNSTILE_SITE_KEY': JSON.stringify(process.env.TURNSTILE_SITE_KEY || env.VITE_TURNSTILE_SITE_KEY || ''),
        },
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
                            // Exact package dirs: a bare 'react-dom' match would also catch @floating-ui/react-dom (game-only)
                            if (/node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) {
                                return 'vendor-react';
                            }
                            if (id.includes('@microsoft/signalr')) {
                                return 'vendor-signalr';
                            }
                            if (id.includes('framer-motion')) {
                                return 'vendor-motion';
                            }
                            // ponytail: no radix group - it's game-only and rides with the lazy GameScreen chunk.
                            // A named group also pulled react-dom into it, forcing radix onto the landing page.
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
