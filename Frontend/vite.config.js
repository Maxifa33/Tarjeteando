import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // Dos páginas: la app y la vista pública de un compartido (link de solo lectura, sin Tarjeteando).
      input: { main: 'index.html', compartido: 'compartido.html' }
    }
  },
  server: {
    port: 5173,
    strictPort: true, // si el 5173 está ocupado, falla en vez de usar otro puerto (CORS del backend y Auth de Supabase solo aceptan 5173)
    open: true
  }
})