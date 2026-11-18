# Consola de GameConsole (Node.js, sin dependencias externas).
# Se construye desde la RAÍZ del repositorio:  docker build -f consola/Dockerfile .
FROM node:22.11.0-alpine3.20

WORKDIR /app
COPY consola/ ./consola/
COPY juegos/ ./juegos/

# Las pruebas corren al construir: si fallan, no hay imagen.
RUN cd consola && node --test \
 && mkdir -p /app/consola/data && chown -R node:node /app/consola/data

ENV PORT=3000 \
    JUEGOS_DIR=/app/juegos \
    INGEST_URL=http://ingest:8080 \
    ANALYTICS_URL=http://analytics:9000 \
    PROLOG_URL=http://prolog:8081

USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -qO- http://localhost:${PORT}/api/juegos >/dev/null || exit 1
CMD ["node", "consola/server.js"]
