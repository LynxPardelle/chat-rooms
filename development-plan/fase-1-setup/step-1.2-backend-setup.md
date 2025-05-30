# 1.2 Setup Backend (NestJS)

## Explicación

Inicializaremos el proyecto backend con NestJS utilizando SWC en lugar de TSC como compilador para mejorar la velocidad de desarrollo. Configuraremos la estructura siguiendo el patrón hexagonal para mantener una separación clara entre dominio, aplicación e infraestructura. Este patrón nos permitirá tener un código más limpio, testeable y mantenible.

## Objetivos

- Configurar NestJS con TypeScript y SWC
- Implementar arquitectura hexagonal
- Instalar dependencias principales para chat, autenticación y WebSockets
- Configurar estructura de carpetas escalable

## Estructura Esperada

`
api/
├── src/
│   ├── application/        # Casos de uso y servicios de aplicación
│   │   ├── services/
│   │   └── dtos/
│   ├── domain/            # Entidades y lógica de negocio
│   │   ├── entities/
│   │   ├── repositories/
│   │   └── interfaces/
│   ├── infrastructure/    # Implementaciones técnicas
│   │   ├── database/
│   │   ├── security/
│   │   └── websockets/
│   └── presentation/      # Capa de presentación
│       ├── controllers/
│       ├── gateways/
│       └── middleware/
├── test/                  # Tests
├── nest-cli.json         # Configuración NestJS
├── package.json          # Dependencias del backend
├── tsconfig.json         # Configuración TypeScript
├── tsconfig.build.json   # Configuración build
└── .swcrc               # Configuración SWC
`

## Dependencias Requeridas

### Dependencias Principales

```json
{
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@nestjs/mongoose": "^10.0.0",
    "@nestjs/jwt": "^10.0.0",
    "@nestjs/passport": "^10.0.0",
    "@nestjs/websockets": "^10.0.0",
    "@nestjs/platform-socket.io": "^10.0.0",
    "socket.io": "^4.7.0",
    "bcrypt": "^5.1.0",
    "class-validator": "^0.14.0",
    "class-transformer": "^0.5.1",
    "helmet": "^7.0.0",
    "express-rate-limit": "^6.8.0",
    "mongoose": "^7.4.0",
    "passport": "^0.6.0",
    "passport-jwt": "^4.0.1",
    "reflect-metadata": "^0.1.13",
    "rxjs": "^7.8.1"
  }
}
```

### Dependencias de Desarrollo

```json
{
  "devDependencies": {
    "@nestjs/cli": "^10.0.0",
    "@nestjs/schematics": "^10.0.0",
    "@nestjs/testing": "^10.0.0",
    "@swc/cli": "^0.1.62",
    "@swc/core": "^1.3.0",
    "@types/bcrypt": "^5.0.0",
    "@types/express": "^4.17.17",
    "@types/jest": "^29.5.2",
    "@types/node": "^20.3.1",
    "@types/passport-jwt": "^3.0.8",
    "@types/supertest": "^2.0.12",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "eslint": "^8.42.0",
    "eslint-config-prettier": "^8.8.0",
    "eslint-plugin-prettier": "^4.2.1",
    "jest": "^29.5.0",
    "prettier": "^2.8.8",
    "source-map-support": "^0.5.21",
    "supertest": "^6.3.3",
    "ts-jest": "^29.1.0",
    "ts-loader": "^9.4.3",
    "ts-node": "^10.9.1",
    "tsconfig-paths": "^4.2.0",
    "typescript": "^5.1.3"
  }
}
```

## Configuración SWC

### Archivo .swcrc

```json
{
  "$schema": "https://json.schemastore.org/swcrc",
  "jsc": {
    "parser": {
      "syntax": "typescript",
      "decorators": true,
      "dynamicImport": true
    },
    "target": "es2020",
    "keepClassNames": true,
    "transform": {
      "legacyDecorator": true,
      "decoratorMetadata": true
    }
  },
  "module": {
    "type": "commonjs"
  },
  "minify": false,
  "sourceMaps": true
}
```

### Actualización nest-cli.json

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "builder": "swc",
    "typeCheck": true
  }
}
```

## Validación

### Checklist de Validación

- [ ] Proyecto NestJS inicializado correctamente
- [ ] Estructura hexagonal implementada (4 carpetas principales en src/)
- [ ] Todas las dependencias instaladas sin errores
- [ ] SWC configurado y funcionando
- [ ] El proyecto compila correctamente
- [ ] El servidor se inicia sin errores con `npm run start:dev`

### Comandos de Verificación

1. **Instalación y build**:

   ```bash
   cd api
   npm install
   npm run build
   ```

2. **Iniciar en modo desarrollo**:

   ```bash
   npm run start:dev
   ```

3. **Verificar estructura**:

   ```bash
   tree src/
   # o
   ls -la src/*/
   ```

4. **Verificar SWC**:

   ```bash
   npm run start:dev
   # Debe mostrar que usa SWC en lugar de tsc
   ```

## Archivos Base a Crear

### src/main.ts (básico)

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
  console.log('🚀 API server running on http://localhost:3001');
}
bootstrap();
```

### src/app.module.ts (básico)

```typescript
import { Module } from '@nestjs/common';

@Module({
  imports: [],
  controllers: [],
  providers: [],
})
export class AppModule {}
```

## Notas de Implementación

- SWC es significativamente más rápido que TSC para desarrollo
- La arquitectura hexagonal facilitará testing y mantenibilidad
- Todas las dependencias son necesarias para las fases posteriores
- Verificar que la versión de Node.js sea compatible (18+)

## Problemas Comunes

- **Error de SWC**: Verificar que la versión de Node.js sea compatible
- **Dependencias**: Usar versiones específicas para evitar incompatibilidades
- **Puerto 3000**: Asegurar que no esté ocupado por otra aplicación

---

**Siguiente paso**: [1.3 Setup Frontend (Vue 3 + TypeScript)](./step-1.3-frontend-setup.md)
