# [BLOQUE DIDACTICO] server/Dockerfile
# Que es: Receta de imagen Docker para el backend.
# Que hace: Construye un contenedor Node listo para desarrollo/ejecucion del servidor.
# Como lo hace: Copia dependencias y codigo, instala con npm ci y expone el puerto de la API.

FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--legacy-watch"]
