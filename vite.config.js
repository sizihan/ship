import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',   // 👈 新增：允许外部访问 localhost
    port: 3000,        // 👈 可改为你想要的端口（默认3000）
    proxy: {
      '/api': {
        target: 'http://localhost:5000', // 👈 指向 Flask 后端
        changeOrigin: true,
      },
    },
  },
})
