import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        // 手动拆分主要第三方依赖，让路由懒加载后的产物更容易缓存和定位体积来源。
        codeSplitting: {
          groups: [
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|react-router-dom|zustand)[\\/]/ },
            { name: 'vendor-antd-core', test: /node_modules[\\/]antd[\\/]/, maxSize: 350 * 1024 },
            { name: 'vendor-antd-icons', test: /node_modules[\\/]@ant-design[\\/]/ },
            { name: 'vendor-rc', test: /node_modules[\\/](rc-|@rc-component)[\\/]/ },
            { name: 'vendor-echarts-core', test: /node_modules[\\/]echarts[\\/](core|charts|components|renderers)[\\/]/ },
            { name: 'vendor-zrender', test: /node_modules[\\/]zrender[\\/]/ },
            { name: 'vendor-syntax', test: /node_modules[\\/](react-syntax-highlighter|refractor|prismjs)[\\/]/ },
            { name: 'vendor-markdown', test: /node_modules[\\/](react-markdown|remark-gfm|hast-|mdast-|micromark|unified|unist-|remark-|rehype-)[\\/]/ },
          ],
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
})
