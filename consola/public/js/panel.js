/*
 * panel.js — PanelEstadisticas.
 *
 * Cada 3 segundos pide /api/panel (la FACHADA del servidor, que a su vez consulta a
 * GameStats) y dibuja lo que llega. La consola NO calcula estadísticas: solo muestra
 * lo que GameStats ya calculó. Separa claramente:
 *   - Estadísticas generales (todos los juegos)
 *   - Partidas en curso (lo que ingest está recibiendo ahora mismo)
 *   - Estadísticas por juego (cada juego del catálogo)
 */
import { $, crear, pedirJSON } from "./emisor.js";

const fmtSeg = (s) => {
  if (s == null || isNaN(s)) return "—";
  s = Number(s);
  return s < 60 ? s.toFixed(1) + " s" : Math.floor(s / 60) + " min " + Math.round(s % 60) + " s";
};
const hora = (t) => (t ? new Date(t).toLocaleTimeString() : "—");
// Nombres de las estadísticas GENERALES (son iguales para cualquier juego: vienen del contrato común).
// Los nombres de las estadísticas ESPECÍFICAS los declara cada juego y llegan desde GameStats ("labels").
const GENERALES = {
  matches: "partidas", wins: "victorias", draws: "empates", losses: "derrotas",
  winPct: "% victorias", bestScore: "mejor puntaje", avgScore: "puntaje promedio",
};
const etiqueta = (clave, labels = {}) =>
  labels[clave] || GENERALES[clave] || clave.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").toLowerCase();
const numero = (v) => (typeof v === "number" ? +v.toFixed(2) : v ?? "—");

export class PanelEstadisticas {
  #timer = null;
  #anteriores = {};

  constructor(catalogo, cadaMs = 3000) {
    this.catalogo = catalogo;
    this.cadaMs = cadaMs;
  }

  iniciar() {
    if (this.#timer) return;
    this.actualizar();
    this.#timer = setInterval(() => this.actualizar(), this.cadaMs);
  }
  detener() { clearInterval(this.#timer); this.#timer = null; }

  async actualizar() {
    try {
      const datos = await pedirJSON("/api/panel");
      this.#generales(datos);
      this.#recordsGenerales(datos.general.juegos);
      this.#enCurso(datos.enCurso);
      this.#porJuego(datos);
      this.#ultimas(datos.general.partidas);
      $("#panel-info").textContent =
        "Todo lo que se ve aquí lo calcula GameStats; la consola solo lo muestra. Actualizado " + hora(datos.actualizado);
    } catch (e) {
      $("#panel-info").textContent = "No se pudo consultar a la consola: " + e.message;
    }
  }

  // ---------- generales ----------
  #generales(d) {
    const g = d.general, ing = g.ingest || {};
    const avisos = [];
    if (!d.conexion.analytics) avisos.push("GameStats analytics no responde (puede estar despertando en Render, espera ~1 minuto).");
    if (!d.conexion.ingest) avisos.push("GameStats ingest no responde.");

    const tarjetas = [
      ["Partidas analizadas", g.partidas ? g.partidas.length : "—"],
      ["Juegos con datos", g.juegos ? g.juegos.length : "—"],
      ["Jugadores distintos", g.jugadores ? g.jugadores.length : "—"],
      ["Partidas en curso", ing.activeMatches ?? "—"],
      ["Eventos recibidos", ing.received ?? "—"],
      ["Eventos válidos", ing.valid ?? "—"],
      ["Eventos rechazados", ing.rejected ?? "—"],
      ["Partidas enviadas a analytics", ing.matchesSent ?? "—"],
    ];
    const cont = $("#generales");
    cont.replaceChildren(
      ...avisos.map((a) => crear("div", { class: "error-panel", text: "⚠ " + a, style: "grid-column: 1 / -1" })),
      ...tarjetas.map(([nombre, valor]) => {
        const cambio = this.#anteriores[nombre] !== undefined && this.#anteriores[nombre] !== valor;
        this.#anteriores[nombre] = valor;
        return crear("div", { class: "tarjeta" + (cambio ? " cambio" : "") },
          crear("div", { class: "valor", text: valor }), crear("div", { class: "nombre", text: nombre }));
      }),
    );
  }

  // ---------- récords de todos los juegos (solo junta las listas que ya calculó GameStats) ----------
  #recordsGenerales(juegos) {
    const cont = $("#records-generales");
    const filas = (juegos || []).flatMap((g) => (g.records || []).map((r) => ({ ...r, gameId: g.gameId })));
    if (!filas.length) return cont.replaceChildren(crear("p", { class: "vacio", text: "Todavía no hay récords: juega una partida hasta el final." }));
    cont.replaceChildren(this.#tablaRecords(filas, true));
  }

  // ---------- en curso ----------
  #enCurso(lista) {
    const cont = $("#en-curso");
    if (!lista) return cont.replaceChildren(crear("p", { class: "nota", text: "Sin conexión con ingest." }));
    if (!lista.length) return cont.replaceChildren(crear("p", { class: "vacio", text: "No hay partidas en curso en este momento." }));
    cont.replaceChildren(crear("table", {},
      crear("tr", {}, ...["Juego", "matchId", "Estado", "Jugadores", "Eventos", "Inicio", "Último evento"].map((t) => crear("th", { text: t }))),
      ...lista.map((m) => crear("tr", {},
        crear("td", { text: this.#nombreJuego(m.gameId) }),
        crear("td", { text: m.matchId, style: "font: 11px Consolas, monospace" }),
        crear("td", { text: m.status }),
        crear("td", { text: (m.players || []).join(", ") }),
        crear("td", { class: "num", text: m.eventCount }),
        crear("td", { text: hora(m.startedAt) }),
        crear("td", { text: hora(m.lastEventAt) }),
      )),
    ));
  }

  // ---------- por juego ----------
  #porJuego(d) {
    const enCurso = d.enCurso || [];
    const fichas = this.catalogo.juegos.map((j) => {
      const r = d.porJuego[j.id];
      const vivos = enCurso.filter((m) => m.gameId === j.id).length;
      if (!r) return crear("div", { class: "ficha" }, crear("h3", { text: `${j.icono} ${j.nombre}` }),
        crear("p", { class: "nota", text: "GameStats no respondió para este juego." }));

      const ficha = crear("div", { class: "ficha" },
        crear("h3", { text: `${j.icono} ${j.nombre}` }),
        crear("div", { class: "mini" },
          crear("div", {}, crear("b", { text: r.matches }), crear("span", { text: "veces jugado (instancias terminadas)" })),
          crear("div", {}, crear("b", { text: vivos }), crear("span", { text: "instancias en curso ahora" })),
          crear("div", {}, crear("b", { text: fmtSeg(r.avgDurationSec) }), crear("span", { text: "tiempo promedio" })),
        ),
        crear("div", { class: "nota", text: `Eventos analizados: ${r.totalEvents}` }),
      );

      if (r.byStatus && Object.keys(r.byStatus).length) {
        ficha.append(crear("h4", { text: "Partidas por estado" }), this.#tablaConteo(r.byStatus));
      }
      if (r.records && r.records.length) {
        ficha.append(crear("h4", { text: "🏆 Récords" }), this.#tablaRecords(r.records));
      }
      if (r.leaderboard && r.leaderboard.length) {
        ficha.append(crear("h4", { text: "Tabla de posiciones (generales + específicas del juego)" }),
          this.#tablaPosiciones(r.leaderboard, r.labels || {}));
      }
      if (r.patternsByRule && Object.keys(r.patternsByRule).length) {
        ficha.append(crear("h4", { text: "Patrones detectados" }), this.#tablaConteo(r.patternsByRule));
      }
      return ficha;
    });
    $("#por-juego").replaceChildren(...(fichas.length ? fichas : [crear("p", { class: "vacio", text: "El catálogo está vacío." })]));
  }

  #tablaConteo(obj) {
    const max = Math.max(...Object.values(obj), 1);
    return crear("table", {}, ...Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([k, v]) =>
      crear("tr", {},
        crear("td", { text: k, style: "width:40%" }),
        crear("td", {}, crear("div", { class: "barra-h", style: `width:${(100 * v) / max}%` })),
        crear("td", { class: "num", text: v }),
      )));
  }

  // Las columnas y sus nombres salen de lo que mande GameStats: sirve para cualquier juego.
  #tablaPosiciones(lista, labels) {
    const orden = [...Object.keys(GENERALES), ...Object.keys(labels)];
    const pos = (c) => (orden.indexOf(c) < 0 ? orden.length : orden.indexOf(c));
    const columnas = [...new Set(lista.flatMap((f) => Object.keys(f.totals || {})))]
      .filter((c) => lista.some((f) => typeof f.totals[c] !== "object" || f.totals[c] === null))
      .sort((a, b) => pos(a) - pos(b));   // primero las generales, luego las del juego
    return crear("table", {},
      crear("tr", {}, crear("th", { text: "#" }), crear("th", { text: "Jugador" }),
        ...columnas.map((c) => crear("th", { class: "num", text: etiqueta(c, labels) }))),
      ...lista.map((f, i) => crear("tr", {},
        crear("td", { text: i + 1 }), crear("td", { text: f.playerId }),
        ...columnas.map((c) => crear("td", { class: "num", text: numero(f.totals[c]) })))));
  }

  // Récords tal como los calcula GameStats: { record, value, unit, playerId, matchId }
  #tablaRecords(lista, conJuego = false) {
    return crear("table", {},
      crear("tr", {}, ...(conJuego ? ["Juego"] : []).concat(["Récord", "Valor", "Quién", "Partida"]).map((t) => crear("th", { text: t }))),
      ...lista.map((r) => crear("tr", {},
        ...(conJuego ? [crear("td", { text: this.#nombreJuego(r.gameId) })] : []),
        crear("td", { text: r.record }),
        crear("td", { class: "num", text: numero(r.value) + (r.unit ? " " + r.unit : "") }),
        crear("td", { text: r.playerId ?? "—" }),
        crear("td", { text: r.matchId, style: "font: 11px Consolas, monospace" }),
      )));
  }

  // ---------- últimas ----------
  #ultimas(partidas) {
    const cont = $("#ultimas");
    if (!partidas || !partidas.length) return cont.replaceChildren(crear("p", { class: "vacio", text: "GameStats todavía no tiene partidas terminadas." }));
    const recientes = [...partidas].sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt))).slice(0, 12);
    cont.replaceChildren(crear("table", {},
      crear("tr", {}, ...["Juego", "matchId", "Estado", "Inicio", "Duración", "Jugadores", "Eventos", "Ganador", "Patrones"].map((t) => crear("th", { text: t }))),
      ...recientes.map((m) => crear("tr", {},
        crear("td", { text: this.#nombreJuego(m.gameId) }),
        crear("td", { text: m.matchId, style: "font: 11px Consolas, monospace" }),
        crear("td", { text: m.status }),
        crear("td", { text: hora(m.startedAt) }),
        crear("td", { class: "num", text: fmtSeg(m.durationSec) }),
        crear("td", { class: "num", text: m.players }),
        crear("td", { class: "num", text: m.eventCount }),
        crear("td", { text: m.winner ?? "—" }),
        crear("td", { text: (m.patterns || []).join(", ") || "—" }),
      ))));
  }

  #nombreJuego(id) {
    const j = this.catalogo.buscar(id);
    return j ? `${j.icono} ${j.nombre}` : id;
  }
}
