# Tutorial Deploy Web App
## Slides para Presentación

---

# Slide 1: Portada

## DEPLOY DE APLICACIÓN WEB
### De localhost a producción

**De tu computadora... al mundo**

Guía paso a paso para publicar tu aplicación web

---

# Slide 2: ¿Qué es un Deploy?

## DESARROLLO → PRODUCCIÓN

```
   TU COMPUTADORA              INTERNET
   ┌──────────┐              ┌──────────┐
   │localhost │    ────►     │ .com     │
   │ Solo vos │              │ Todos    │
   └──────────┘              └──────────┘
```

**Deploy** = Publicar tu app para que cualquiera pueda acceder

---

# Slide 3: Arquitectura Web

## LAS 3 CAPAS

```
┌─────────────────────────────┐
│         FRONTEND            │  ← Lo que el usuario VE
│   (React, HTML, CSS)        │     Vercel
└─────────────────────────────┘
              │
              ▼
┌─────────────────────────────┐
│         BACKEND             │  ← La LÓGICA del servidor
│   (Node.js, APIs)           │     Railway
└─────────────────────────────┘
              │
              ▼
┌─────────────────────────────┐
│       BASE DE DATOS         │  ← Donde se GUARDAN los datos
│   (PostgreSQL, SQLite)      │     Railway / Supabase
└─────────────────────────────┘
```

---

# Slide 4: Servicios que Usamos

## STACK DE DEPLOY

| Servicio | Para qué | Costo |
|----------|----------|-------|
| **GitHub** | Guardar código | Gratis |
| **Railway** | Backend | $5/mes gratis |
| **Vercel** | Frontend | Gratis |

**Total: $0 para empezar**

---

# Slide 5: Paso 1 - Preparar el Código

## CONFIGURACIONES NECESARIAS

### Backend (Node.js)
```javascript
// Puerto dinámico
const PORT = process.env.PORT || 3000;

// CORS para producción
const allowedOrigins = [
  'http://localhost:5173',
  process.env.FRONTEND_URL
];
```

### Frontend (React)
```javascript
// URL de API dinámica
const API = import.meta.env.VITE_API_URL
         || 'http://localhost:3000/api/v1';
```

---

# Slide 6: Paso 2 - GitHub

## SUBIR CÓDIGO A GITHUB

### Comandos:
```bash
# 1. Inicializar Git
git init

# 2. Agregar archivos
git add -A

# 3. Crear commit
git commit -m "Initial commit"

# 4. Conectar con GitHub
git remote add origin https://github.com/USER/REPO.git

# 5. Subir
git push -u origin main
```

---

# Slide 7: Paso 3 - Railway (Backend)

## DEPLOY DEL BACKEND

1. Ir a **railway.app**
2. Login con GitHub
3. "New Project" → "Deploy from GitHub"
4. Seleccionar repositorio
5. **Root Directory** = `Backend`
6. Configurar variables de entorno

### Variables necesarias:
- `ANTHROPIC_API_KEY`
- `FRONTEND_URL`

---

# Slide 8: Paso 4 - Vercel (Frontend)

## DEPLOY DEL FRONTEND

1. Ir a **vercel.com**
2. Login con GitHub
3. "Add New" → "Project"
4. Seleccionar repositorio
5. **Root Directory** = `Frontend`
6. Agregar variable:
   - `VITE_API_URL` = URL del backend

---

# Slide 9: Conexión Final

## FRONTEND ↔ BACKEND

```
┌─────────────┐              ┌─────────────┐
│   VERCEL    │              │   RAILWAY   │
│             │    HTTPS     │             │
│  Frontend   │ ──────────►  │   Backend   │
│             │              │             │
│ VITE_API_URL│              │FRONTEND_URL │
│     ▼       │              │     ▼       │
│ railway.app │              │ vercel.app  │
└─────────────┘              └─────────────┘
```

**CORS** permite la comunicación entre dominios

---

# Slide 10: Flujo de Actualizaciones

## DEPLOY AUTOMÁTICO

```
┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐
│ Código │───►│ GitHub │───►│Railway/│───►│  App   │
│        │push│        │auto│ Vercel │    │updated │
└────────┘    └────────┘    └────────┘    └────────┘
```

### Solo necesitás:
```bash
git add -A
git commit -m "Cambios"
git push
```

**¡Deploy automático!**

---

# Slide 11: Resultado Final

## TU APP EN PRODUCCIÓN

| Componente | URL |
|------------|-----|
| **Frontend** | tarjeteando-iota.vercel.app |
| **Backend** | tarjeteando-production.up.railway.app |
| **Código** | github.com/Maxifa33/Tarjeteando |

---

# Slide 12: Problemas Comunes

## TROUBLESHOOTING

| Error | Solución |
|-------|----------|
| CORS blocked | Agregar `FRONTEND_URL` en Railway |
| Failed to fetch | Verificar `VITE_API_URL` |
| 502 Bad Gateway | Ver logs en Railway |
| Deploy falla | Verificar Root Directory |

---

# Slide 13: Próximos Pasos

## MEJORAS AVANZADAS

### 1. Dominio Personalizado
- Vercel: Settings → Domains
- Configurar DNS

### 2. Base de Datos Persistente
- PostgreSQL en Railway
- Datos NO se pierden en redeploy

### 3. Autenticación
- Auth0 (fácil)
- JWT propio (más control)

---

# Slide 14: Checklist de Deploy

## ANTES DE DEPLOYAR

- [ ] `.gitignore` creado
- [ ] No hay API keys en el código
- [ ] Puerto dinámico en backend
- [ ] URL dinámica en frontend

## DESPUÉS DE DEPLOYAR

- [ ] Health check responde OK
- [ ] Frontend carga sin errores
- [ ] Datos se muestran correctamente

---

# Slide 15: Resumen

## LO QUE APRENDIMOS

1. **Arquitectura**: Frontend + Backend + DB
2. **GitHub**: Control de versiones
3. **Railway**: Deploy de backend Node.js
4. **Vercel**: Deploy de frontend React
5. **Variables de entorno**: Configuración segura
6. **CORS**: Comunicación entre servicios

---

# Slide 16: Recursos

## LINKS ÚTILES

- **Railway**: railway.app
- **Vercel**: vercel.com
- **GitHub**: github.com
- **Auth0**: auth0.com

## Documentación
- Railway Docs: docs.railway.app
- Vercel Docs: vercel.com/docs

---

# Slide 17: Final

## ¡FELICITACIONES!

### Tu app está en producción

```
    🚀
   /|\
  / | \
 /  |  \
/   |   \
---------
```

**De localhost al mundo**
