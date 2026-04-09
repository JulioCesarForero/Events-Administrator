# Frontend

Aplicacion React del portal comprador y panel de comite.

## Prerrequisitos

- Node.js 20+
- npm 10+

## Instalacion

```bash
npm ci
```

## Variables de entorno

Crear `.env.local`:

```env
VITE_API_BASE_URL=http://localhost/api
VITE_APP_ENV=local
```

## Ejecucion en desarrollo

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Pruebas

```bash
npm run test
```

## Estructura

- `src/features`: modulos por dominio
- `src/pages`: paginas por ruta
- `src/services`: clientes API
- `src/state`: estado global
- `src/hooks`: hooks reutilizables
