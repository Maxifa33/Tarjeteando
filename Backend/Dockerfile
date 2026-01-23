FROM node:18-alpine

WORKDIR /app

# Instalar dependencias del sistema necesarias para canvas y sharp
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev \
    librsvg-dev

# Copiar package.json primero para cachear dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el resto del código
COPY . .

# Puerto
EXPOSE 3000

# Comando de inicio
CMD ["npm", "start"]
