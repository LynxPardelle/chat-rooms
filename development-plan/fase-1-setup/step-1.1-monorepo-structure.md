# 1.1 Estructura Base del Monorepo

## Explicación

Crearemos la estructura básica del monorepo que contendrá tanto el backend (NestJS) como el frontend (Vue 3). Esta estructura nos permitirá mantener ambas partes del proyecto organizadas y facilitar la gestión de dependencias compartidas. También configuraremos archivos comunes como `.gitignore` y un `README.md` principal.

## Objetivos

- Establecer la estructura fundamental del monorepo
- Configurar archivos base del proyecto
- Crear documentación inicial
- Configurar scripts globales de desarrollo

## Estructura Esperada

`
chat-rooms/
├── api/                    # Backend NestJS
├── front/                  # Frontend Vue 3
├── .gitignore             # Configuración global de Git
├── README.md              # Documentación principal
├── package.json           # Scripts globales
└── development-plan/      # Documentación del plan (este directorio)
`

## Validación

### Checklist de Validación

- [ ] La carpeta `/api` existe y está vacía
- [ ] La carpeta `/front` existe y está vacía
- [ ] El archivo `.gitignore` está configurado correctamente
- [ ] El `README.md` contiene información completa del proyecto
- [ ] El `package.json` raíz incluye scripts útiles para desarrollo
- [ ] La estructura del proyecto está claramente documentada

### Verificación Técnica

1. **Estructura de carpetas**:

   ```bash
   ls -la
   # Debe mostrar las carpetas api/ y front/
   ```

2. **Archivos base**:

   ```bash
   cat .gitignore
   cat README.md
   cat package.json
   ```

3. **Scripts globales** (ejemplos esperados):

   ```json
   {
     "scripts": {
       "dev:api": "cd api && npm run start:dev",
       "dev:front": "cd front && npm run dev",
       "dev": "concurrently \"npm run dev:api\" \"npm run dev:front\"",
       "build:api": "cd api && npm run build",
       "build:front": "cd front && npm run build",
       "build": "npm run build:api && npm run build:front"
     }
   }
   ```

## Notas de Implementación

- Usar gitignore completo que cubra Node.js, TypeScript, IDEs, y sistemas operativos
- El README.md debe ser profesional y completo para nuevos desarrolladores
- Los scripts del package.json raíz deben facilitar el trabajo con el monorepo
- Considerar usar `concurrently` para ejecutar múltiples comandos de desarrollo

## Recursos Útiles

- [Gitignore templates](https://github.com/github/gitignore)
- [Monorepo best practices](https://monorepo.tools/)
- [NPM workspace documentation](https://docs.npmjs.com/cli/v7/using-npm/workspaces)

---

**Siguiente paso**: [1.2 Setup Backend (NestJS)](./step-1.2-backend-setup.md)
