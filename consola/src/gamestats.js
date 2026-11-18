/*
 * gamestats.js — ClienteGameStats: patrón FACADE + PROXY.
 *
 * GameStats (Proyecto 1) no tiene CORS, así que el navegador no puede leer sus respuestas.
 * El servidor de la consola hace de intermediario (PROXY): el navegador le habla a la consola
 * y la consola le habla a GameStats.
 *
 * Además es una FACHADA: el panel pide "dame todo lo del panel" en una sola llamada y no
 * necesita saber que por dentro hay dos servicios (ingest en Go y analytics en Scala).
 *
 * IMPORTANTE: aquí NO se calcula ninguna estadística. Solo se piden y se devuelven tal cual.
 */
class ClienteGameStats {
  constructor(ingestUrl, analyticsUrl) {
    this.ingestUrl = ingestUrl;
    this.analyticsUrl = analyticsUrl;
  }

  // Reenvía uno o varios eventos a ingest (POST /events). Devuelve la respuesta de ingest.
  async enviarEventos(cuerpoTexto) {
    const r = await fetch(this.ingestUrl + "/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: cuerpoTexto,
      signal: AbortSignal.timeout(15000),
    });
    const texto = await r.text();
    return { status: r.status, cuerpo: texto };
  }

  // GET a analytics, solo rutas de /results (lectura).
  resultados(ruta) { return this._get(this.analyticsUrl, "/results" + ruta); }

  // Lo que ingest sabe AHORA (partidas en curso y contadores de eventos).
  partidasEnCurso() { return this._get(this.ingestUrl, "/matches"); }
  contadoresIngest() { return this._get(this.ingestUrl, "/stats"); }

  // FACHADA para el panel: todo en una sola respuesta.
  async panel(idsJuegos) {
    const [juegos, partidas, jugadores, enCurso, ingest, ...porJuego] = await Promise.allSettled([
      this.resultados("/games"),
      this.resultados("/matches"),
      this.resultados("/players"),
      this.partidasEnCurso(),
      this.contadoresIngest(),
      ...idsJuegos.map((id) => this.resultados("/games/" + encodeURIComponent(id))),
    ]);
    const valor = (p) => (p.status === "fulfilled" ? p.value : null);
    const resumenPorJuego = {};
    idsJuegos.forEach((id, i) => { resumenPorJuego[id] = valor(porJuego[i]); });
    return {
      actualizado: new Date().toISOString(),
      conexion: {
        analytics: juegos.status === "fulfilled",
        ingest: ingest.status === "fulfilled",
      },
      general: { juegos: valor(juegos), partidas: valor(partidas), jugadores: valor(jugadores), ingest: valor(ingest) },
      enCurso: valor(enCurso),
      porJuego: resumenPorJuego,
    };
  }

  async _get(base, ruta) {
    const r = await fetch(base + ruta, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`${base}${ruta} respondió ${r.status}`);
    return r.json();
  }
}

module.exports = { ClienteGameStats };
