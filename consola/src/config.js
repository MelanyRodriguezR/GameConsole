/*
 * config.js — Toda la configuración sale de variables de entorno.
 * Así la misma consola corre en tu PC, en Docker o en Render sin cambiar código.
 */
const path = require("path");

const sinBarraFinal = (u) => (u || "").replace(/\/+$/, "");

module.exports = {
  PUERTO: Number(process.env.PORT || 3000),

  // Carpeta donde viven los juegos. Cada subcarpeta con un manifest.json es un juego.
  JUEGOS_DIR: path.resolve(process.env.JUEGOS_DIR || path.join(__dirname, "..", "..", "juegos")),

  // Juegos externos agregados por URL mientras la consola corre (se guardan aquí).
  EXTERNOS_ARCHIVO: path.resolve(process.env.EXTERNOS_ARCHIVO || path.join(__dirname, "..", "data", "externos.json")),

  // GameStats (Proyecto 1)
  INGEST_URL: sinBarraFinal(process.env.INGEST_URL || "http://localhost:8080"),
  ANALYTICS_URL: sinBarraFinal(process.env.ANALYTICS_URL || "http://localhost:9000"),

  // Servicio de Prolog (SWI-Prolog)
  PROLOG_URL: sinBarraFinal(process.env.PROLOG_URL || "http://localhost:8081"),

  PUBLICO_DIR: path.join(__dirname, "..", "public"),
};
