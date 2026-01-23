FROM node:18-slim

WORKDIR /app

# Instalar dependencias del sistema para canvas, sharp y mupdf
# Usar slim y instalar solo lo necesario
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    libpixman-1-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Copiar package.json primero para cachear dependencias
COPY package*.json ./

# Instalar dependencias con npm ci para builds reproducibles
RUN npm ci --only=production

# Copiar el resto del codigo
COPY . .

# Crear directorio para datos
RUN mkdir -p data uploads

# Puerto
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/v1/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Comando de inicio
CMD ["node", "src/app.js"]
