# MERN minimal starter

Estructura base para API Express + MongoDB y cliente React con Vite.

## Requisitos
- Node.js 18+
- npm 9+
- Docker (opcional para MongoDB local)

## Configuración
1) Duplica `.env.example` a `.env` y ajusta valores.
2) Instala dependencias en el monorepo:
   ```bash
   npm install
   ```
3) Contenedores (Mongo + API + Web):
   ```bash
   docker compose up --build
   ```
   - Web: http://localhost:4173
   - API: http://localhost:4000/api/health

## Scripts principales
- Desarrollo full-stack: `npm run dev`
- Solo API: `npm run dev:server`
- Solo web: `npm run dev:client`
- Lint: `npm run lint`
- Build: `npm run build`
- Producción API: `npm start`

## API de ejemplo
- GET `/api/health` devuelve `{ status: "ok", uptime }`.

## Notas
- `client` usa Vite + React + TypeScript.
- `server` usa Express + TypeScript y se conecta a Mongo si `MONGODB_URI` está definido.
