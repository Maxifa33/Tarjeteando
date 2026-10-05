import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true, // si el 5173 está ocupado, falla en vez de usar otro puerto (CORS del backend y Auth de Supabase solo aceptan 5173)
    open: true
  }
})