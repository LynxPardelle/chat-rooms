# 2.2 Docker para Despliegue

## Explicación

Aunque usaremos MongoDB local para el desarrollo, necesitamos preparar la configuración de Docker para el despliegue final. Crearemos un archivo docker-compose.yml que incluirá todos los servicios necesarios para ejecutar la aplicación en un entorno de producción.

## Objetivos

- Configurar Docker Compose para todos los servicios
- Preparar configuración diferenciada por environment
- Establecer volúmenes persistentes para datos
- Configurar redes y variables de entorno

## Estructura de Archivos Docker

`
/
├── docker-compose.yml              # Configuración base
├── docker-compose.dev.yml          # Override para desarrollo
├── docker-compose.prod.yml         # Override para producción
├── .dockerignore                   # Ignorar archivos globales
├── api/
│   ├── Dockerfile                  # Dockerfile del backend
│   ├── Dockerfile.dev              # Dockerfile para desarrollo
│   └── .dockerignore              # Ignorar archivos del API
└── front/
    ├── Dockerfile                  # Dockerfile del frontend
    ├── Dockerfile.dev              # Dockerfile para desarrollo
    ├── nginx.conf                  # Configuración Nginx para desarrollo
    ├── nginx.prod.conf             # Configuración Nginx para producción
    └── .dockerignore              # Ignorar archivos del frontend
`

## Variables de Entorno Requeridas

### Archivo .env (para desarrollo)

```env
# Base de datos
MONGODB_URI=mongodb://mongo:27017/livechat
MONGODB_DATABASE=livechat

# Backend
NODE_ENV=development
PORT=3001
JWT_SECRET=your-super-secret-jwt-key-for-development
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:5173

# Frontend
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001

# Redis (para sesiones y cache)
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=

# Uploads
UPLOAD_PATH=/app/uploads
MAX_FILE_SIZE=10485760
```

### Archivo .env.prod (para producción)

```env
# Base de datos
MONGODB_URI=mongodb://mongo:27017/livechat
MONGODB_DATABASE=livechat

# Backend
NODE_ENV=production
PORT=3001
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=24h
CORS_ORIGIN=https://yourapp.com

# Frontend
VITE_API_URL=https://api.yourapp.com
VITE_WS_URL=wss://api.yourapp.com

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_PASSWORD}

# Uploads
UPLOAD_PATH=/app/uploads
MAX_FILE_SIZE=10485760
```

## Configuración Docker Compose

### docker-compose.yml (Base)

```yaml
version: '3.8'

services:
  mongo:
    image: mongo:7.0
    container_name: livechat_mongo
    restart: unless-stopped
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_ROOT_USERNAME:-admin}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_ROOT_PASSWORD:-password}
      MONGO_INITDB_DATABASE: ${MONGODB_DATABASE:-livechat}
    volumes:
      - mongo_data:/data/db
      - ./data/mongo/init:/docker-entrypoint-initdb.d
    networks:
      - livechat-network
    healthcheck:
      test: echo 'db.runCommand("ping").ok' | mongosh localhost:27017/test --quiet
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  redis:
    image: redis:7.2-alpine
    container_name: livechat_redis
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD:-}
    volumes:
      - redis_data:/data
    networks:
      - livechat-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  api:
    build:
      context: ./api
      dockerfile: Dockerfile
    container_name: livechat_api
    restart: unless-stopped
    environment:
      - NODE_ENV=${NODE_ENV:-production}
      - PORT=${PORT:-3000}
      - MONGODB_URI=${MONGODB_URI}
      - JWT_SECRET=${JWT_SECRET}
      - JWT_EXPIRES_IN=${JWT_EXPIRES_IN:-24h}
      - REDIS_HOST=${REDIS_HOST:-redis}
      - REDIS_PORT=${REDIS_PORT:-6379}
      - REDIS_PASSWORD=${REDIS_PASSWORD:-}
      - UPLOAD_PATH=${UPLOAD_PATH:-/app/uploads}
      - MAX_FILE_SIZE=${MAX_FILE_SIZE:-10485760}
    volumes:
      - uploads_data:/app/uploads
      - ./api/logs:/app/logs
    networks:
      - livechat-network
    depends_on:
      mongo:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

  frontend:
    build:
      context: ./front
      dockerfile: Dockerfile
    container_name: livechat_frontend
    restart: unless-stopped
    environment:
      - VITE_API_URL=${VITE_API_URL}
      - VITE_WS_URL=${VITE_WS_URL}
    networks:
      - livechat-network
    depends_on:
      api:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:80"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  mongo_data:
    driver: local
  redis_data:
    driver: local
  uploads_data:
    driver: local

networks:
  livechat-network:
    driver: bridge
```

### docker-compose.dev.yml (Desarrollo)

```yaml
version: '3.8'

services:
  mongo:
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: password
      MONGO_INITDB_DATABASE: livechat

  redis:
    ports:
      - "6379:6379"

  api:
    build:
      context: ./api
      dockerfile: Dockerfile.dev
    environment:
      - NODE_ENV=development
      - PORT=3001
      - MONGODB_URI=mongodb://admin:password@mongo:27017/livechat?authSource=admin
      - JWT_SECRET=dev-secret-key
      - CORS_ORIGIN=http://localhost:5173
    ports:
      - "3000:3000"
    volumes:
      - ./api/src:/app/src
      - ./api/package.json:/app/package.json
      - uploads_data:/app/uploads

  frontend:
    build:
      context: ./front
      dockerfile: Dockerfile.dev
    environment:
      - VITE_API_URL=http://localhost:3001
      - VITE_WS_URL=ws://localhost:3001
    ports:
      - "5173:5173"
    volumes:
      - ./front/src:/app/src
      - ./front/package.json:/app/package.json
```

### docker-compose.prod.yml (Producción)

```yaml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    container_name: livechat_nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    networks:
      - livechat-network
    depends_on:
      - frontend
      - api

  mongo:
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_ROOT_USERNAME}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_ROOT_PASSWORD}
    volumes:
      - /opt/livechat/data/mongo:/data/db

  api:
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://${MONGO_ROOT_USERNAME}:${MONGO_ROOT_PASSWORD}@mongo:27017/livechat?authSource=admin
    volumes:
      - /opt/livechat/uploads:/app/uploads
      - /opt/livechat/logs:/app/logs

volumes:
  mongo_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /opt/livechat/data/mongo
  uploads_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /opt/livechat/uploads
```

## Dockerfiles

### api/Dockerfile (Producción)

```dockerfile
# Etapa de construcción
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar archivos de configuración
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

# Instalar dependencias
RUN npm ci --only=production && npm cache clean --force

# Copiar código fuente
COPY src/ ./src/

# Construir aplicación
RUN npm run build

# Etapa de producción
FROM node:20-alpine AS production

WORKDIR /app

# Instalar dumb-init para manejo de señales
RUN apk add --no-cache dumb-init curl

# Crear usuario no-root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

# Copiar dependencias de producción
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package*.json ./

# Crear directorios necesarios
RUN mkdir -p uploads logs && chown -R nestjs:nodejs /app

USER nestjs

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]
```

### api/Dockerfile.dev (Desarrollo)

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Instalar herramientas de desarrollo
RUN apk add --no-cache curl

# Copiar archivos de configuración
COPY package*.json ./

# Instalar todas las dependencias (incluidas dev)
RUN npm install

# Copiar código fuente
COPY . .

EXPOSE 3001
CMD ["npm", "run", "start:dev"]
```

### front/Dockerfile (Producción)

```dockerfile
# Etapa de construcción
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar archivos de configuración
COPY package*.json ./
COPY tsconfig*.json ./
COPY vite.config.ts ./

# Instalar dependencias
RUN npm ci --only=production && npm cache clean --force

# Copiar código fuente
COPY src/ ./src/
COPY public/ ./public/
COPY index.html ./

# Construir aplicación
RUN npm run build

# Etapa de producción
FROM nginx:alpine AS production

# Copiar configuración de nginx
COPY nginx.prod.conf /etc/nginx/nginx.conf

# Copiar archivos construidos
COPY --from=builder /app/dist /usr/share/nginx/html

# Crear usuario no-root
RUN addgroup -g 1001 -S nginx
RUN adduser -S nginx -u 1001

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:80 || exit 1

CMD ["nginx", "-g", "daemon off;"]
```

### front/Dockerfile.dev (Desarrollo)

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copiar archivos de configuración
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar código fuente
COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

## Archivos .dockerignore

### .dockerignore (Raíz)

```dockerignore
node_modules
npm-debug.log
.git
.gitignore
README.md
.env
.env.local
.env.*.local
coverage
.nyc_output
dist
build
.docker
```

### api/.dockerignore

```dockerignore
node_modules
npm-debug.log
.git
.gitignore
README.md
.env
.env.local
.env.*.local
coverage
.nyc_output
dist
logs
uploads
.docker
src/**/*.spec.ts
src/**/*.test.ts
test/
```

### front/.dockerignore

```dockerignore
node_modules
npm-debug.log
.git
.gitignore
README.md
.env
.env.local
.env.*.local
coverage
.nyc_output
dist
build
tests/
test-results/
playwright-report/
.docker
```

## Comandos de Uso

### Desarrollo

```bash
# Iniciar servicios de desarrollo
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Ver logs en tiempo real
docker-compose logs -f

# Parar servicios
docker-compose down

# Reconstruir imágenes
docker-compose build --no-cache
```

### Producción

```bash
# Iniciar servicios de producción
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Verificar estado de servicios
docker-compose ps

# Ver logs de un servicio específico
docker-compose logs api

# Actualizar solo un servicio
docker-compose build api
docker-compose up -d --no-deps api
```

## Checklist de Validación

### ✅ Configuración Base

- [ ] `docker-compose.yml` creado con todos los servicios
- [ ] Volúmenes persistentes configurados
- [ ] Redes internas configuradas
- [ ] Health checks implementados

### ✅ Archivos de Environment

- [ ] `.env` para desarrollo
- [ ] `.env.prod` para producción
- [ ] Variables de entorno documentadas

### ✅ Dockerfiles

- [ ] `api/Dockerfile` optimizado para producción
- [ ] `api/Dockerfile.dev` para desarrollo
- [ ] `front/Dockerfile` con nginx
- [ ] `front/Dockerfile.dev` para desarrollo

### ✅ Configuración de Nginx

- [ ] `front/nginx.conf` para desarrollo
- [ ] `front/nginx.prod.conf` para producción
- [ ] Configuración SSL preparada

### ✅ Archivos .dockerignore

- [ ] `.dockerignore` en raíz
- [ ] `api/.dockerignore` configurado
- [ ] `front/.dockerignore` configurado

### ✅ Testing

- [ ] Servicios arrancan correctamente en desarrollo
- [ ] Health checks funcionando
- [ ] Comunicación entre servicios establecida
- [ ] Datos persisten entre reinicios

## Troubleshooting

### Problema: Servicios no se conectan

```bash
# Verificar red
docker network ls
docker network inspect livechat_livechat-network

# Verificar DNS interno
docker exec livechat_api ping mongo
```

### Problema: Base de datos no persiste

```bash
# Verificar volúmenes
docker volume ls
docker volume inspect livechat_mongo_data
```

### Problema: Frontend no encuentra API

```bash
# Verificar variables de entorno
docker exec livechat_frontend env | grep VITE

# Verificar nginx configuración
docker exec livechat_frontend cat /etc/nginx/nginx.conf

`
    ├── nginx.conf                  # Configuración Nginx
    └── .dockerignore              # Ignorar archivos del frontend
`

## docker-compose.yml (Base)

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:7.0
    container_name: livechat_mongodb
    restart: unless-stopped
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_ROOT_USERNAME:-admin}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_ROOT_PASSWORD:-password123}
      MONGO_INITDB_DATABASE: ${MONGO_DB_NAME:-livechat}
    ports:
      - "${MONGO_PORT:-27017}:27017"
    volumes:
      - mongodb_data:/data/db
      - mongodb_config:/data/configdb
    networks:
      - livechat_network
    healthcheck:
      test: echo 'db.runCommand("ping").ok' | mongosh localhost:27017/test --quiet
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  api:
    build:
      context: ./api
      dockerfile: Dockerfile
    container_name: livechat_api
    restart: unless-stopped
    environment:
      NODE_ENV: ${NODE_ENV:-production}
      DATABASE_URL: mongodb://mongodb:27017/${MONGO_DB_NAME:-livechat}
      JWT_SECRET: ${JWT_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      UPLOAD_PATH: ${UPLOAD_PATH:-/app/uploads}
    ports:
      - "${API_PORT:-3000}:3000"
    volumes:
      - uploads_data:/app/uploads
    networks:
      - livechat_network
    depends_on:
      mongodb:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  frontend:
    build:
      context: ./front
      dockerfile: Dockerfile
    container_name: livechat_frontend
    restart: unless-stopped
    environment:
      VITE_API_URL: ${VITE_API_URL:-http://localhost:3001}
      VITE_WS_URL: ${VITE_WS_URL:-ws://localhost:3001}
    ports:
      - "${FRONTEND_PORT:-80}:80"
    networks:
      - livechat_network
    depends_on:
      api:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:80/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  mongodb_data:
    driver: local
  mongodb_config:
    driver: local
  uploads_data:
    driver: local

networks:
  livechat_network:
    driver: bridge
```

## docker-compose.dev.yml

```yaml
version: '3.8'

services:
  mongodb:
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: devpassword
      MONGO_INITDB_DATABASE: livechat_dev

  api:
    build:
      context: ./api
      dockerfile: Dockerfile.dev
    environment:
      NODE_ENV: development
      DATABASE_URL: mongodb://mongodb:27017/livechat_dev
    volumes:
      - ./api:/app
      - /app/node_modules
      - uploads_data:/app/uploads
    command: npm run start:dev

  frontend:
    build:
      context: ./front
      dockerfile: Dockerfile.dev
    environment:
      VITE_API_URL: http://localhost:3001
      VITE_WS_URL: ws://localhost:3001
    volumes:
      - ./front:/app
      - /app/node_modules
    ports:
      - "5173:5173"
    command: npm run dev
```

## api/Dockerfile

```dockerfile
# Multi-stage build for production
FROM node:18-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS production
WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Copy production dependencies
COPY --from=base /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json ./

# Create uploads directory
RUN mkdir -p uploads && chown -R node:node uploads

# Switch to non-root user
USER node

EXPOSE 3001
# Health check endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

CMD ["node", "dist/main.js"]
```

## api/Dockerfile.dev

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3001
CMD ["npm", "run", "start:dev"]
```

## front/Dockerfile

```dockerfile
# Multi-stage build
FROM node:18-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

# Add health check
RUN apk add --no-cache curl
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## front/nginx.conf

```nginx
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    
    sendfile        on;
    keepalive_timeout  65;
    
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json;

    server {
        listen 80;
        server_name localhost;
        root /usr/share/nginx/html;
        index index.html;

        # SPA configuration
        location / {
            try_files $uri $uri/ /index.html;
        }

        # API proxy (if needed)
        location /api {
            proxy_pass http://api:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }

        # WebSocket proxy
        location /socket.io {
            proxy_pass http://api:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Health check endpoint
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }
}
```

## Variables de Entorno

### .env.example

```bash
# Environment
NODE_ENV=production

# Database
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=your_secure_password
MONGO_DB_NAME=livechat
MONGO_PORT=27017

# API
API_PORT=3001
JWT_SECRET=your_jwt_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
UPLOAD_PATH=/app/uploads

# Frontend
FRONTEND_PORT=80
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

## Problemas Comunes

- **Puertos ocupados**: Cambiar puertos en variables de entorno
- **Volúmenes**: Usar `docker-compose down -v` para limpiar volúmenes
- **Build cache**: Usar `--no-cache` para builds limpios
- **Networking**: Verificar que los nombres de servicios coincidan

---

**Siguiente paso**: [2.3 Modelos de Base de Datos](./step-2.3-database-models.md)
