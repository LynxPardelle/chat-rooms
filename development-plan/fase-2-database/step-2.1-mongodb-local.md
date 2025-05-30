# 2.1 MongoDB Local para Desarrollo

## Explicación

Configuraremos MongoDB para desarrollo local sin Docker. Esto simplificará el proceso de desarrollo y permitirá una iteración más rápida. Instalaremos MongoDB localmente y configuraremos una base de datos para nuestro proyecto.

## Objetivos

- Configurar conexión a MongoDB local
- Implementar configuración por variables de entorno
- Crear módulo NestJS para base de datos
- Establecer configuración de desarrollo optimizada

## Estructura de Archivos

`
api/src/infrastructure/database/
├── config/
│   ├── database.config.ts        # Configuración principal
│   └── database.interfaces.ts    # Interfaces de configuración
├── database.module.ts             # Módulo principal de BD
└── connection.service.ts          # Servicio de conexión
`

## Configuración de Variables de Entorno

### .env (development)

```bash
# Database Configuration
DATABASE_URL=mongodb://localhost:27017/livechat_dev
DATABASE_NAME=livechat_dev
DATABASE_HOST=localhost
DATABASE_PORT=27017

# Optional Authentication
DATABASE_USERNAME=
DATABASE_PASSWORD=

# Connection Options
DATABASE_MAX_POOL_SIZE=10
DATABASE_SERVER_SELECTION_TIMEOUT=5000
DATABASE_SOCKET_TIMEOUT=45000
DATABASE_CONNECT_TIMEOUT=10000
```

### .env.example

```bash
# Database Configuration
DATABASE_URL=mongodb://localhost:27017/livechat_dev
DATABASE_NAME=livechat_dev
DATABASE_HOST=localhost
DATABASE_PORT=27017

# Authentication (opcional)
DATABASE_USERNAME=
DATABASE_PASSWORD=

# Connection Options
DATABASE_MAX_POOL_SIZE=10
DATABASE_SERVER_SELECTION_TIMEOUT=5000
DATABASE_SOCKET_TIMEOUT=45000
DATABASE_CONNECT_TIMEOUT=10000
```

## Implementación Sugerida

### database.config.ts

```typescript
import { ConfigService } from '@nestjs/config';
import { MongooseModuleOptions } from '@nestjs/mongoose';

export interface DatabaseConfig {
  url: string;
  name: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
  options: MongooseModuleOptions;
}

export const getDatabaseConfig = (configService: ConfigService): DatabaseConfig => {
  const environment = configService.get<string>('NODE_ENV', 'development');
  
  return {
    url: configService.get<string>('DATABASE_URL') || 
         `mongodb://${configService.get<string>('DATABASE_HOST', 'localhost')}:${configService.get<number>('DATABASE_PORT', 27017)}/${configService.get<string>('DATABASE_NAME', 'livechat_dev')}`,
    name: configService.get<string>('DATABASE_NAME', 'livechat_dev'),
    host: configService.get<string>('DATABASE_HOST', 'localhost'),
    port: configService.get<number>('DATABASE_PORT', 27017),
    username: configService.get<string>('DATABASE_USERNAME'),
    password: configService.get<string>('DATABASE_PASSWORD'),
    options: {
      maxPoolSize: configService.get<number>('DATABASE_MAX_POOL_SIZE', 10),
      serverSelectionTimeoutMS: configService.get<number>('DATABASE_SERVER_SELECTION_TIMEOUT', 5000),
      socketTimeoutMS: configService.get<number>('DATABASE_SOCKET_TIMEOUT', 45000),
      connectTimeoutMS: configService.get<number>('DATABASE_CONNECT_TIMEOUT', 10000),
      retryWrites: true,
      retryReads: true,
      // Configuraciones específicas por environment
      ...(environment === 'development' && {
        bufferMaxEntries: 0,
        bufferCommands: false,
        maxStalenessSeconds: 2,
      }),
      ...(environment === 'production' && {
        writeConcern: { w: 'majority', j: true },
        readConcern: { level: 'majority' },
      })
    }
  };
};
```

### database.module.ts

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { getDatabaseConfig } from './config/database.config';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const dbConfig = getDatabaseConfig(configService);
        
        console.log(`🗄️  Connecting to MongoDB at ${dbConfig.host}:${dbConfig.port}/${dbConfig.name}`);
        
        return {
          uri: dbConfig.url,
          ...dbConfig.options,
          onConnectionCreate: (connection: any) => {
            console.log('✅ MongoDB connection established');
            return connection;
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {}
```

## Instalación de MongoDB Local

### Windows

```bash
# Usando Chocolatey
choco install mongodb

# O descarga desde https://www.mongodb.com/try/download/community
```

### macOS

```bash
# Usando Homebrew
brew tap mongodb/brew
brew install mongodb-community

# Iniciar servicio
brew services start mongodb/brew/mongodb-community
```

### Linux (Ubuntu)

```bash
# Importar clave GPG
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -

# Agregar repositorio
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Instalar
sudo apt-get update
sudo apt-get install -y mongodb-org

# Iniciar servicio
sudo systemctl start mongod
sudo systemctl enable mongod
```

## Configuración en main.ts

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  
  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));
  
  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
  
  console.log(`🚀 API server running on http://localhost:${port}`);
}
bootstrap();
```

## Actualización de app.module.ts

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './infrastructure/database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
```

## Validación

### Checklist de Validación

- [ ] MongoDB instalado y ejecutándose localmente
- [ ] Variables de entorno configuradas en .env
- [ ] DatabaseModule implementado correctamente
- [ ] ConfigModule configurado para variables globales
- [ ] Conexión exitosa mostrada en logs
- [ ] Aplicación inicia sin errores de conexión

### Comandos de Verificación

1. **Verificar MongoDB local**:

   ```bash
   # Verificar que MongoDB esté corriendo
   mongosh --eval "db.adminCommand('ismaster')"
   ```

2. **Probar conexión desde la aplicación**:

   ```bash
   cd api
   npm run start:dev
   # Buscar en logs: "✅ MongoDB connection established"
   ```

3. **Verificar base de datos creada**:

   ```bash
   mongosh
   show dbs
   # Debe aparecer 'livechat_dev' después de la primera conexión
   ```

4. **Test de configuración**:

   ```bash
   # Verificar que las variables de entorno se lean correctamente
   node -e "console.log(require('dotenv').config())"
   ```

## Problemas Comunes y Soluciones

### MongoDB no se conecta

1. **Verificar servicio**:

   ```bash
   # Windows
   net start MongoDB
   
   # macOS
   brew services restart mongodb/brew/mongodb-community
   
   # Linux
   sudo systemctl status mongod
   ```

2. **Verificar puerto**: Asegurar que el puerto 27017 no esté ocupado
3. **Permisos**: En Linux, verificar permisos del directorio de datos

### Variables de entorno no se leen

1. Verificar que el archivo `.env` esté en la raíz del proyecto `/api`
2. Instalar `@nestjs/config` si no está instalado
3. Verificar que `ConfigModule.forRoot()` esté en AppModule

### Errores de conexión timeout

1. Ajustar timeouts en la configuración
2. Verificar que MongoDB esté aceptando conexiones
3. Revisar configuración de firewall local

## Herramientas Recomendadas

- **MongoDB Compass**: GUI oficial para gestión de base de datos
- **Studio 3T**: Herramienta avanzada para desarrollo con MongoDB
- **VS Code Extensions**: MongoDB for VS Code

---

**Siguiente paso**: [2.2 Docker para Despliegue](./step-2.2-docker-deployment.md)
