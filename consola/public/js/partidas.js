/*
 * partidas.js — Cómo se crean y se controlan las INSTANCIAS de los juegos.
 *
 *   FabricaPartidas → patrón FACTORY: a partir de un manifiesto crea una Partida
 *                     (o una pestaña nueva) sin saber de qué juego se trata.
 *   Partida         → una instancia: su propio iframe, su propio id y su propio matchId.
 *   GestorPartidas  → lleva la lista de partidas abiertas y recibe los mensajes que
 *                     mandan los juegos (window.postMessage) para saber su estado.
 *                     Hace de MEDIADOR: los juegos no conocen a la consola ni entre sí.
 *
 * Cada juego corre aislado en su iframe, así que varias partidas a la vez no se
 * bloquean ni mezclan sus eventos.
 */
import { Emisor, crear } from "./emisor.js";

let contador = 0;
const nuevaInstancia = (gameId) =>
  `${gameId}-${Date.now().toString(36)}-${(++contador).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// Lo que la consola le pasa a cada juego por la URL (parte del CONTRATO).
function urlDelJuego(juego, instancia, modo, dentroDeConsola) {
  const u = new URL(juego.url, location.origin);
  u.searchParams.set("gamestats", location.origin + "/api/events");   // a dónde mandar los eventos
  u.searchParams.set("prolog", location.origin + "/api/prolog");      // servicio de IA (si el juego lo usa)
  u.searchParams.set("instancia", instancia);
  if (modo) u.searchParams.set("modo", modo);
  if (dentroDeConsola) u.searchParams.set("consola", "1");
  return u.href;
}

export class Partida extends Emisor {
  constructor(juego, modo) {
    super();
    this.juego = juego;
    this.modo = modo;
    this.instancia = nuevaInstancia(juego.id);
    this.estado = "cargando";          // cargando | esperando | jugando | terminado
    this.matchId = null;
    this.eventos = 0;
    this.partidasJugadas = 0;
    this.elemento = this.#dibujar();
  }

  #dibujar() {
    this.iframe = crear("iframe", {
      src: urlDelJuego(this.juego, this.instancia, this.modo, true),
      title: this.juego.nombre,
      allow: "autoplay; fullscreen; gamepad",
    });
    this.lblEstado = crear("span", { class: "estado", text: "cargando" });
    this.lblMatch = crear("span", { class: "match", text: "instancia " + this.instancia });
    const caja = crear("article", { class: "partida" },
      crear("header", {},
        crear("b", { text: `${this.juego.icono} ${this.juego.nombre}` }),
        this.modo ? crear("span", { class: "estado", text: this.modo }) : null,
        this.lblEstado, this.lblMatch,
        crear("button", { class: "secundario", title: "Agrandar / achicar", text: "⤢", onclick: () => caja.classList.toggle("grande") }),
        crear("button", { class: "secundario", title: "Recargar el juego", text: "↻", onclick: () => this.recargar() }),
        crear("button", { class: "secundario", title: "Cerrar esta partida", text: "✕", onclick: () => this.cerrar() }),
      ),
      this.iframe,
    );
    this.iframe.addEventListener("load", () => { if (this.estado === "cargando") this.#cambiarEstado("esperando"); });
    caja.addEventListener("pointerdown", () => this.emitir("enfoque", this));
    return caja;
  }

  // Llega un mensaje del juego (ver juegos/*/js/gamestats.js → avisarConsola)
  recibir(msj) {
    if (msj.tipo === "evento" && msj.evento) {
      this.eventos++;
      const e = msj.evento;
      if (e.action === "MATCH_STARTED") {
        this.matchId = e.matchId;
        this.partidasJugadas++;
        this.lblMatch.textContent = "matchId " + e.matchId;
        this.lblMatch.title = e.matchId;
        this.#cambiarEstado("jugando");
      } else if (e.action === "MATCH_FINISHED") {
        const g = e.data && e.data.winner;
        this.#cambiarEstado("terminado", g ? "terminó · ganó " + g : "terminó");
      }
      this.emitir("evento", { partida: this, evento: e });
    }
  }

  #cambiarEstado(estado, texto) {
    this.estado = estado;
    this.lblEstado.textContent = texto || estado;
    this.lblEstado.className = "estado " + estado;
    this.emitir("estado", this);
  }

  recargar() { this.iframe.src = this.iframe.src; this.#cambiarEstado("cargando"); }
  enfocar() { this.iframe.focus(); }
  cerrar() { this.elemento.remove(); this.emitir("cerrada", this); }
}

export class FabricaPartidas {
  crear(juego, modo) { return new Partida(juego, modo); }

  // Otra forma de jugar en paralelo: una pestaña nueva del navegador.
  abrirEnPestana(juego, modo) {
    window.open(urlDelJuego(juego, nuevaInstancia(juego.id), modo, false), "_blank", "noopener");
  }
}

export class GestorPartidas extends Emisor {
  #partidas = new Map();   // instancia → Partida

  constructor(contenedor, fabrica = new FabricaPartidas()) {
    super();
    this.contenedor = contenedor;
    this.fabrica = fabrica;
    window.addEventListener("message", (ev) => this.#alMensaje(ev));
  }

  get partidas() { return [...this.#partidas.values()]; }

  abrir(juego, modo) {
    const p = this.fabrica.crear(juego, modo);
    this.#partidas.set(p.instancia, p);
    p.on("cerrada", () => { this.#partidas.delete(p.instancia); this.emitir("cambio", this.partidas); });
    p.on("estado", () => this.emitir("cambio", this.partidas));
    p.on("enfoque", () => this.#marcarEnfocada(p));
    this.contenedor.querySelector(".vacio")?.remove();
    this.contenedor.prepend(p.elemento);
    this.#marcarEnfocada(p);
    p.elemento.scrollIntoView({ behavior: "smooth", block: "nearest" });
    this.emitir("cambio", this.partidas);
    return p;
  }

  abrirEnPestana(juego, modo) { this.fabrica.abrirEnPestana(juego, modo); }

  #marcarEnfocada(p) {
    for (const otra of this.#partidas.values()) otra.elemento.classList.toggle("enfocada", otra === p);
  }

  // Solo se aceptan mensajes de un iframe nuestro y con la forma del contrato.
  #alMensaje(ev) {
    const m = ev.data;
    if (!m || m.fuente !== "gameconsole-juego" || !m.instancia) return;
    const p = this.#partidas.get(m.instancia);
    if (!p || ev.source !== p.iframe.contentWindow) return;
    p.recibir(m);
  }
}
