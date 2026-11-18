/*
 * server.js — Servidor de GameConsole (Node.js puro, sin dependencias).
 *
 *   /                         la consola web (public/)
 *   /juegos/<id>/...          los archivos de cada juego (carpeta JUEGOS_DIR)
 *
 *   GET    /api/juegos        lista DINÁMICA de juegos (se lee de nuevo en cada llamada)
 *   POST   /api/juegos        { "manifestUrl": "https://.../manifest.json" } agrega un juego externo
 *   DELETE /api/juegos/<id>   quita un juego externo
 *
 *   POST   /api/events        los juegos mandan aquí sus eventos → se reenvían a GameStats ingest
 *   GET    /api/panel         todo lo que muestra el panel (viene de GameStats, no se recalcula)
 *   GET    /api/results/...   acceso directo de lectura a analytics /results/...
 *   POST   /api/prolog/<ruta> se reenvía al servicio de Prolog (la IA del combate)
 *   GET    /api/salud         estado de la consola y de los servicios conectados
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const cfg = require("./src/config");
const { RegistroJuegos, ErrorContrato } = require("./src/registro");
const { ClienteGameStats } = require("./src/gamestats");

const registro = RegistroJuegos.obtener(cfg.JUEGOS_DIR, cfg.EXTERNOS_ARCHIVO);
const gamestats = new ClienteGameStats(cfg.INGEST_URL, cfg.ANALYTICS_URL);

const TIPOS = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon",
  ".mp3": "audio/mpeg", ".wav": "audio/wav", ".pl": "text/plain; charset=utf-8",
};
const LIMITE_CUERPO = 1024 * 1024;   // 1 MB

// ---------------- utilidades ----------------
function json(res, status, datos) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(datos));
}

function leerCuerpo(req) {
  return new Promise((resolve, reject) => {
    let tam = 0; const partes = [];
    req.on("data", (c) => {
      tam += c.length;
      if (tam > LIMITE_CUERPO) { reject(new Error("cuerpo demasiado grande")); req.destroy(); return; }
      partes.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(partes).toString("utf8")));
    req.on("error", reject);
  });
}

// Permite que juegos EXTERNOS (otro dominio) manden eventos a la consola.
function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function archivoEstatico(res, base, relativo) {
  const destino = path.resolve(base, "." + path.sep + relativo);
  if (destino !== base && !destino.startsWith(base + path.sep)) return json(res, 403, { error: "ruta no permitida" });
  fs.stat(destino, (err, st) => {
    if (!err && st.isDirectory()) return archivoEstatico(res, base, path.join(relativo, "index.html"));
    if (err) return json(res, 404, { error: "no encontrado" });
    res.writeHead(200, {
      "Content-Type": TIPOS[path.extname(destino).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    fs.createReadStream(destino).pipe(res);
  });
}

// ---------------- rutas de la API ----------------
async function api(req, res, ruta) {
  cors(res);
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  // --- catálogo de juegos (REGISTRY) ---
  if (ruta === "/api/juegos" && req.method === "GET") {
    const juegos = registro.listar();
    return json(res, 200, { juegos, problemas: registro.problemas });
  }
  if (ruta === "/api/juegos" && req.method === "POST") {
    try {
      const { manifestUrl } = JSON.parse(await leerCuerpo(req) || "{}");
      const juego = await registro.registrarExterno(manifestUrl);
      return json(res, 201, { juego });
    } catch (e) {
      if (e instanceof ErrorContrato) return json(res, 400, { error: "el juego no cumple el contrato", detalles: e.errores });
      return json(res, 400, { error: e.message });
    }
  }
  const quitar = ruta.match(/^\/api\/juegos\/([^/]+)$/);
  if (quitar && req.method === "DELETE") {
    return registro.quitarExterno(decodeURIComponent(quitar[1]))
      ? json(res, 200, { ok: true })
      : json(res, 404, { error: "no hay un juego externo con ese id" });
  }

  // --- eventos → GameStats ingest (PROXY) ---
  if (ruta === "/api/events" && req.method === "POST") {
    let cuerpo;
    try {
      cuerpo = await leerCuerpo(req);
      JSON.parse(cuerpo);                                   // solo se revisa que sea JSON
    } catch {
      return json(res, 400, { error: "el cuerpo debe ser JSON (un evento o una lista de eventos)" });
    }
    try {
      const r = await gamestats.enviarEventos(cuerpo);
      res.writeHead(r.status, { "Content-Type": "application/json; charset=utf-8" });
      return res.end(r.cuerpo);
    } catch (e) {
      return json(res, 502, { error: "GameStats ingest no responde", detalle: e.message });
    }
  }

  // --- panel (FACADE) ---
  if (ruta === "/api/panel" && req.method === "GET") {
    const ids = registro.listar().map((j) => j.id);
    return json(res, 200, await gamestats.panel(ids));
  }
  if (ruta.startsWith("/api/results") && req.method === "GET") {
    try {
      const url = new URL(req.url, "http://x");
      return json(res, 200, await gamestats.resultados(ruta.slice("/api/results".length) + url.search));
    } catch (e) {
      return json(res, 502, { error: "GameStats analytics no responde", detalle: e.message });
    }
  }

  // --- Prolog (la IA) ---
  if (ruta.startsWith("/api/prolog/") && req.method === "POST") {
    try {
      const cuerpo = await leerCuerpo(req);
      const r = await fetch(cfg.PROLOG_URL + ruta.slice("/api/prolog".length), {
        method: "POST", headers: { "Content-Type": "application/json" }, body: cuerpo,
        signal: AbortSignal.timeout(3000),
      });
      res.writeHead(r.status, { "Content-Type": "application/json; charset=utf-8" });
      return res.end(await r.text());
    } catch (e) {
      return json(res, 502, { error: "el servicio de Prolog no responde", detalle: e.message });
    }
  }

  // --- salud ---
  if (ruta === "/api/salud") {
    const probar = async (url) => {
      try { return (await fetch(url, { signal: AbortSignal.timeout(5000) })).ok; } catch { return false; }
    };
    const [ingest, analytics, prolog] = await Promise.all([
      probar(cfg.INGEST_URL + "/health"), probar(cfg.ANALYTICS_URL + "/health"), probar(cfg.PROLOG_URL + "/health"),
    ]);
    return json(res, 200, {
      consola: true, ingest, analytics, prolog,
      urls: { ingest: cfg.INGEST_URL, analytics: cfg.ANALYTICS_URL, prolog: cfg.PROLOG_URL },
    });
  }

  return json(res, 404, { error: "ruta de API desconocida" });
}

// ---------------- servidor ----------------
const servidor = http.createServer(async (req, res) => {
  let ruta;
  try { ruta = decodeURIComponent(new URL(req.url, "http://x").pathname); } catch { return json(res, 400, { error: "URL inválida" }); }
  try {
    if (ruta.startsWith("/api/")) return await api(req, res, ruta);
    if (ruta.startsWith("/juegos/")) return archivoEstatico(res, cfg.JUEGOS_DIR, ruta.slice("/juegos/".length));
    return archivoEstatico(res, cfg.PUBLICO_DIR, ruta === "/" ? "index.html" : ruta.slice(1));
  } catch (e) {
    console.error(e);
    if (!res.headersSent) json(res, 500, { error: "error interno" });
  }
});

if (require.main === module) {
  servidor.listen(cfg.PUERTO, () => {
    console.log(`GameConsole en http://localhost:${cfg.PUERTO}`);
    console.log(`  juegos:    ${cfg.JUEGOS_DIR}`);
    console.log(`  ingest:    ${cfg.INGEST_URL}`);
    console.log(`  analytics: ${cfg.ANALYTICS_URL}`);
    console.log(`  prolog:    ${cfg.PROLOG_URL}`);
  });
}

module.exports = { servidor };
