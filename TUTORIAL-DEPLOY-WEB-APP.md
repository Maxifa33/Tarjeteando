# Tutorial Completo: Deploy de Aplicación Web
## De localhost a producción en la nube

---

# PARTE 1: CONCEPTOS FUNDAMENTALES

## ¿Qué es un "Deploy"?

Deploy (o despliegue) es el proceso de publicar tu aplicación en internet para que cualquier persona pueda acceder a ella desde cualquier lugar del mundo.

```
┌─────────────────┐         ┌─────────────────┐
│   DESARROLLO    │         │   PRODUCCIÓN    │
│   (localhost)   │  ───►   │   (internet)    │
│   Solo vos      │         │   Todo el mundo │
└─────────────────┘         └─────────────────┘
```

## Arquitectura de una Aplicación Web Moderna

```
┌─────────────────────────────────────────────────────────────┐
│                        USUARIO                               │
│                    (navegador web)                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       FRONTEND                               │
│              (lo que el usuario ve)                          │
│                                                              │
│   • HTML, CSS, JavaScript                                    │
│   • React, Vue, Angular                                      │
│   • Corre en el NAVEGADOR del usuario                        │
│                                                              │
│   Hosting: Vercel, Netlify, GitHub Pages                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ (peticiones HTTP/API)
┌─────────────────────────────────────────────────────────────┐
│                       BACKEND                                │
│              (la lógica del servidor)                        │
│                                                              │
│   • Node.js, Python, Java, etc.                              │
│   • APIs, procesamiento de datos                             │
│   • Corre en un SERVIDOR en la nube                          │
│                                                              │
│   Hosting: Railway, Heroku, AWS, DigitalOcean                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    BASE DE DATOS                             │
│              (donde se guardan los datos)                    │
│                                                              │
│   • PostgreSQL, MySQL, MongoDB                               │
│   • SQLite (solo desarrollo)                                 │
│                                                              │
│   Hosting: Railway, Supabase, PlanetScale                    │
└─────────────────────────────────────────────────────────────┘
```

## Servicios que Usamos

| Servicio | Propósito | Costo |
|----------|-----------|-------|
| **GitHub** | Almacenar código fuente | Gratis |
| **Railway** | Hosting del Backend | $5 USD/mes gratis |
| **Vercel** | Hosting del Frontend | Gratis (generous) |

---

# PARTE 2: PREPARACIÓN DEL PROYECTO

## Paso 1: Estructura de Carpetas Correcta

```
mi-proyecto/
├── Backend/                 # Servidor (Node.js)
│   ├── src/
│   │   └── app.js          # Archivo principal
│   ├── package.json        # Dependencias
│   └── .env.example        # Variables de entorno (ejemplo)
│
├── Frontend/               # Interfaz (React)
│   ├── src/
│   │   ├── App.jsx        # Componente principal
│   │   └── main.jsx       # Entry point
│   ├── package.json       # Dependencias
│   └── .env.example       # Variables de entorno (ejemplo)
│
├── .gitignore             # Archivos a ignorar en Git
└── README.md              # Documentación
```

## Paso 2: Crear archivo .gitignore

**¿Qué es?** Lista de archivos que Git NO debe subir (contraseñas, dependencias, etc.)

```gitignore
# Dependencias (se reinstalan con npm install)
node_modules/

# Variables de entorno (contienen secretos)
.env
.env.local
.env*
!.env.example

# Build (se regenera)
dist/
build/

# Sistema operativo
.DS_Store

# Archivos de IDE
.vscode/
.idea/
```

## Paso 3: Configurar el Backend para Producción

### 3.1 Puerto dinámico
En producción, el servicio asigna el puerto automáticamente:

```javascript
// ❌ MAL - puerto fijo
const PORT = 3000;

// ✅ BIEN - puerto dinámico
const PORT = process.env.PORT || 3000;
```

### 3.2 CORS para producción
Permitir que el frontend se comunique con el backend:

```javascript
const allowedOrigins = [
  'http://localhost:5173',           // Desarrollo
  process.env.FRONTEND_URL           // Producción
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  }
}));
```

### 3.3 Health Check
Endpoint para verificar que el servidor está vivo:

```javascript
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
```

### 3.4 Variables de entorno condicionales
Cargar .env solo en desarrollo:

```javascript
const envPath = require('path').join(__dirname, '..', '.env');
if (require('fs').existsSync(envPath)) {
  // Solo en desarrollo - en producción las variables vienen del entorno
  require('dotenv').config({ path: envPath });
}
```

## Paso 4: Configurar el Frontend para Producción

### 4.1 URL de API dinámica

```javascript
// ❌ MAL - URL fija
const API_BASE = 'http://localhost:3000/api/v1';

// ✅ BIEN - URL desde variable de entorno
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
```

### 4.2 Archivo .env.example

```env
# Documentación para otros desarrolladores
VITE_API_URL=http://localhost:3000/api/v1
```

---

# PARTE 3: SUBIR CÓDIGO A GITHUB

## Paso 1: Crear cuenta en GitHub
1. Ir a https://github.com
2. Click en "Sign up"
3. Completar registro

## Paso 2: Crear repositorio
1. Click en "+" → "New repository"
2. Nombre: `mi-proyecto`
3. Visibilidad: Private (si tiene datos sensibles)
4. **NO marcar** "Add README" ni otras opciones
5. Click "Create repository"

## Paso 3: Instalar Homebrew (macOS)
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```
Seguir las instrucciones post-instalación.

## Paso 4: Instalar GitHub CLI
```bash
brew install gh
```

## Paso 5: Autenticarse con GitHub
```bash
gh auth login
```
Elegir:
- GitHub.com
- HTTPS
- Login with web browser

## Paso 6: Inicializar Git en tu proyecto
```bash
cd /ruta/a/mi-proyecto
git init
git add -A
git commit -m "Initial commit"
```

## Paso 7: Conectar y subir a GitHub
```bash
git remote add origin https://github.com/TU_USUARIO/mi-proyecto.git
git push -u origin main
```

---

# PARTE 4: DEPLOY DEL BACKEND EN RAILWAY

## Paso 1: Crear cuenta en Railway
1. Ir a https://railway.app
2. Click "Login" → "Login with GitHub"
3. Autorizar acceso

## Paso 2: Crear nuevo proyecto
1. Click "New Project"
2. Seleccionar "Deploy from GitHub repo"
3. Elegir tu repositorio
4. **Importante**: Configurar "Root Directory" = `Backend`

## Paso 3: Esperar el build
Railway detecta Node.js automáticamente y:
1. Instala dependencias (npm install)
2. Ejecuta el servidor (npm start o node src/app.js)

## Paso 4: Obtener URL pública
Una vez deployado, Railway asigna una URL como:
```
https://mi-proyecto-production.up.railway.app
```

## Paso 5: Configurar variables de entorno
En Railway → tu proyecto → Variables:

| Variable | Valor |
|----------|-------|
| `ANTHROPIC_API_KEY` | tu-api-key-secreta |
| `FRONTEND_URL` | https://mi-proyecto.vercel.app |

## Paso 6: Verificar funcionamiento
```bash
curl https://mi-proyecto-production.up.railway.app/api/v1/health
# Debe responder: {"status":"ok",...}
```

---

# PARTE 5: DEPLOY DEL FRONTEND EN VERCEL

## Paso 1: Crear cuenta en Vercel
1. Ir a https://vercel.com
2. Click "Login" → "Continue with GitHub"

## Paso 2: Importar proyecto
1. Click "Add New..." → "Project"
2. Seleccionar tu repositorio
3. Configurar:
   - **Root Directory**: `Frontend`
   - **Framework Preset**: Vite

## Paso 3: Configurar variables de entorno
Expandir "Environment Variables" y agregar:

| Name | Value |
|------|-------|
| `VITE_API_URL` | https://mi-proyecto-production.up.railway.app/api/v1 |

## Paso 4: Deploy
Click "Deploy" y esperar ~1-2 minutos.

## Paso 5: Obtener URL
Vercel asigna una URL como:
```
https://mi-proyecto.vercel.app
```

---

# PARTE 6: CONECTAR FRONTEND Y BACKEND

## Diagrama de conexión

```
┌─────────────────────┐         ┌─────────────────────┐
│       VERCEL        │         │      RAILWAY        │
│                     │         │                     │
│  Frontend (React)   │ ──────► │  Backend (Node.js)  │
│                     │  HTTPS  │                     │
│  VITE_API_URL ──────┼─────────┼──► Recibe requests  │
│                     │         │                     │
│  tarjeteando-       │         │  tarjeteando-       │
│  iota.vercel.app    │         │  production.        │
│                     │         │  up.railway.app     │
└─────────────────────┘         └─────────────────────┘
```

## Checklist de conexión

- [ ] Backend tiene CORS configurado para aceptar requests del frontend
- [ ] Backend tiene variable `FRONTEND_URL` con URL de Vercel
- [ ] Frontend tiene variable `VITE_API_URL` con URL de Railway
- [ ] Ambos servicios están deployados y funcionando

---

# PARTE 7: FLUJO DE ACTUALIZACIONES

Una vez configurado, actualizar la app es simple:

```bash
# 1. Hacer cambios en el código
# 2. Guardar y commitear
git add -A
git commit -m "Descripción del cambio"

# 3. Subir a GitHub
git push

# 4. Deploy automático
# Railway y Vercel detectan el push y re-deployean automáticamente
```

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Código  │────►│  GitHub  │────►│ Railway/ │────►│   App    │
│  local   │push │          │auto │  Vercel  │     │ updated  │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
```

---

# PARTE 8: RESUMEN DE URLS Y SERVICIOS

## Tu aplicación deployada

| Componente | URL | Servicio |
|------------|-----|----------|
| Frontend | https://tarjeteando-iota.vercel.app | Vercel |
| Backend | https://tarjeteando-production.up.railway.app | Railway |
| Código | https://github.com/Maxifa33/Tarjeteando | GitHub |

## Variables de entorno configuradas

### Railway (Backend)
| Variable | Descripción |
|----------|-------------|
| `PORT` | Automático (Railway lo asigna) |
| `ANTHROPIC_API_KEY` | API key para servicios de IA |
| `FRONTEND_URL` | URL del frontend para CORS |

### Vercel (Frontend)
| Variable | Descripción |
|----------|-------------|
| `VITE_API_URL` | URL completa del backend API |

---

# PARTE 9: TROUBLESHOOTING (Solución de problemas)

## Error: "CORS policy blocked"
**Causa**: El backend no permite requests desde el frontend.
**Solución**: Agregar `FRONTEND_URL` en Railway con la URL de Vercel.

## Error: "Failed to fetch"
**Causa**: La URL del backend está mal configurada.
**Solución**: Verificar `VITE_API_URL` en Vercel. Debe incluir `/api/v1`.

## Error: "502 Bad Gateway"
**Causa**: El backend crasheó.
**Solución**: Ver logs en Railway → tu servicio → "Logs".

## El deploy falla en Railway
**Causa común**: No encuentra el package.json.
**Solución**: Verificar que "Root Directory" sea `Backend`.

## Los cambios no se ven
**Causa**: Cache del navegador.
**Solución**: Ctrl+Shift+R (hard refresh) o limpiar cache.

---

# PARTE 10: PRÓXIMOS PASOS AVANZADOS

## A. Dominio Personalizado

### En Vercel (Frontend)
1. Ir a tu proyecto → "Settings" → "Domains"
2. Agregar tu dominio: `miapp.com`
3. Configurar DNS en tu registrador:
   ```
   Tipo: CNAME
   Nombre: www
   Valor: cname.vercel-dns.com

   Tipo: A
   Nombre: @
   Valor: 76.76.21.21
   ```

### En Railway (Backend)
1. Ir a tu servicio → "Settings" → "Networking" → "Custom Domain"
2. Agregar: `api.miapp.com`
3. Configurar DNS:
   ```
   Tipo: CNAME
   Nombre: api
   Valor: tu-servicio.up.railway.app
   ```

---

## B. Base de Datos Persistente (PostgreSQL)

### ¿Por qué migrar de SQLite?
- SQLite: datos se pierden en cada redeploy
- PostgreSQL: datos persisten para siempre

### Paso 1: Agregar PostgreSQL en Railway
1. En tu proyecto Railway → "New" → "Database" → "PostgreSQL"
2. Railway crea la base y te da la URL de conexión

### Paso 2: Instalar dependencias
```bash
cd Backend
npm install pg
```

### Paso 3: Modificar el código
```javascript
// Antes (SQLite)
const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./data.db');

// Después (PostgreSQL)
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
```

### Paso 4: Configurar variable
Railway agrega automáticamente `DATABASE_URL` cuando conectás la base de datos.

---

## C. Autenticación de Usuarios

### Opción 1: Auth0 (Recomendado para empezar)

#### Paso 1: Crear cuenta en Auth0
1. Ir a https://auth0.com
2. Crear aplicación "Single Page Application"

#### Paso 2: Instalar en Frontend
```bash
npm install @auth0/auth0-react
```

#### Paso 3: Configurar Provider
```jsx
import { Auth0Provider } from '@auth0/auth0-react';

<Auth0Provider
  domain="tu-tenant.auth0.com"
  clientId="tu-client-id"
  redirectUri={window.location.origin}
>
  <App />
</Auth0Provider>
```

#### Paso 4: Usar en componentes
```jsx
import { useAuth0 } from '@auth0/auth0-react';

function LoginButton() {
  const { loginWithRedirect, logout, user, isAuthenticated } = useAuth0();

  if (isAuthenticated) {
    return (
      <div>
        <p>Hola, {user.name}</p>
        <button onClick={logout}>Cerrar sesión</button>
      </div>
    );
  }

  return <button onClick={loginWithRedirect}>Iniciar sesión</button>;
}
```

### Opción 2: JWT propio (Más control, más trabajo)

#### Backend - Crear token
```javascript
const jwt = require('jsonwebtoken');

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  // Verificar credenciales en base de datos
  const user = verificarUsuario(email, password);

  if (user) {
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Credenciales inválidas' });
  }
});
```

#### Backend - Middleware de autenticación
```javascript
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido' });
  }
}

// Usar en rutas protegidas
app.get('/api/mis-datos', authMiddleware, (req, res) => {
  // req.user contiene los datos del usuario autenticado
});
```

#### Frontend - Guardar y usar token
```javascript
// Al hacer login
const response = await fetch('/api/login', {
  method: 'POST',
  body: JSON.stringify({ email, password })
});
const { token } = await response.json();
localStorage.setItem('token', token);

// En cada request
fetch('/api/mis-datos', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  }
});
```

---

# GLOSARIO DE TÉRMINOS

| Término | Definición |
|---------|------------|
| **API** | Interfaz para que programas se comuniquen entre sí |
| **Backend** | Servidor que procesa lógica y datos |
| **Build** | Proceso de compilar código para producción |
| **CORS** | Política de seguridad para requests entre dominios |
| **Deploy** | Publicar aplicación en un servidor |
| **Frontend** | Interfaz visual que ve el usuario |
| **Git** | Sistema de control de versiones |
| **GitHub** | Plataforma para alojar repositorios Git |
| **JWT** | Token para autenticación de usuarios |
| **Node.js** | Runtime de JavaScript para servidores |
| **npm** | Gestor de paquetes de Node.js |
| **PostgreSQL** | Base de datos relacional |
| **Railway** | Plataforma de hosting para backends |
| **React** | Librería de JavaScript para interfaces |
| **Repositorio** | Carpeta de proyecto con historial Git |
| **SQLite** | Base de datos simple en archivo |
| **SSL/HTTPS** | Conexión segura encriptada |
| **Vercel** | Plataforma de hosting para frontends |
| **Vite** | Herramienta de build para frontend |

---

# CHECKLIST FINAL DE DEPLOY

## Antes de subir a GitHub
- [ ] Archivo `.gitignore` creado
- [ ] No hay API keys en el código
- [ ] Archivos `.env.example` documentados
- [ ] Puerto del backend es dinámico (`process.env.PORT`)
- [ ] URL del API en frontend es dinámica (`import.meta.env.VITE_API_URL`)

## En GitHub
- [ ] Repositorio creado (público o privado)
- [ ] Código subido con `git push`

## En Railway (Backend)
- [ ] Proyecto creado desde GitHub
- [ ] Root Directory = `Backend`
- [ ] Variables de entorno configuradas
- [ ] Health check responde OK

## En Vercel (Frontend)
- [ ] Proyecto importado desde GitHub
- [ ] Root Directory = `Frontend`
- [ ] `VITE_API_URL` configurada
- [ ] Deploy exitoso

## Conexión
- [ ] Frontend puede llamar al backend sin errores CORS
- [ ] Datos se muestran correctamente

---

**Documento creado el 20 de Enero de 2026**
**Proyecto: Tarjeteando - Gestor de Resúmenes de Tarjetas**
