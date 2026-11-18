/*
 * gamestats.js — Todo lo que conecta el juego con GameStats (Proyecto 1).
 *
 *   Emisor          → patrón OBSERVER: otros objetos se suscriben a lo que pasa.
 *   EnviadorEventos → manda los eventos a GameStats en lotes, sin congelar el juego,
 *                     y reintenta si no hay conexión.
 *   JuegoBase       → patrón TEMPLATE METHOD: el ciclo de toda partida
 *                     (iniciar → jugar → terminar) con los eventos de GameStats.
 *
 * El formato de cada evento es el mismo que valida GameStats (ingest/internal/event/event.go):
 *   { eventId, timestamp, gameId, gameVersion, matchId, playerId, type, action, data }
 */
(function (global) {
  "use strict";

  function nuevoId() {
    if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID();
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
  }

  // "Ana López" → "ana-lopez" (playerId estable)
  function aPlayerId(nombre, porDefecto) {
    var limpio = String(nombre || "")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return limpio || porDefecto;
  }

  // ---------------- Parámetros que manda la consola (CONTRATO) ----------------
  //   ?gamestats=<url de eventos>  ?prolog=<url de la IA>  ?instancia=<id>  ?modo=<modo>  ?consola=1
  var PARAMS = new URLSearchParams(global.location.search);
  var EN_CONSOLA = PARAMS.get("consola") === "1" && global.parent !== global;

  // Le cuenta a la consola lo que pasa (si el juego está dentro de un iframe de la consola).
  function avisarConsola(tipo, datos) {
    if (!EN_CONSOLA || !PARAMS.get("instancia")) return;
    try {
      global.parent.postMessage(Object.assign({ fuente: "gameconsole-juego", instancia: PARAMS.get("instancia"), tipo: tipo }, datos), "*");
    } catch (e) { /* la consola no es obligatoria */ }
  }

  // ---------------- OBSERVER ----------------
  class Emisor {
    constructor() { this._oyentes = {}; }
    on(nombre, fn) { (this._oyentes[nombre] = this._oyentes[nombre] || []).push(fn); return this; }
    emitir(nombre, dato) { (this._oyentes[nombre] || []).forEach(function (fn) { fn(dato); }); }
  }

  // ---------------- Envío ----------------
  class EnviadorEventos extends Emisor {
    constructor(url) {
      super();
      this.url = url || null;     // null = no enviar
      this._cola = [];
      this._enviando = false;
      this._fallos = 0;
      this._timer = null;
      this.enviados = 0;
    }

    cambiarDestino(url) {
      this.url = url || null;
      this._fallos = 0;
      if (!this.url) this._cola = [];
      clearTimeout(this._timer); this._timer = null;
      this._programar(0);
      this.emitir("estado", this.resumen());
    }

    agregar(evento) {
      if (!this.url) return;
      this._cola.push(evento);
      if (this._fallos) this.emitir("estado", this.resumen());   // que se vea cuántos esperan
      this._programar(150);
    }

    resumen() {
      return { url: this.url, enviados: this.enviados, pendientes: this._cola.length, ok: this._fallos === 0 };
    }

    // Si el destino es la consola (misma página o su /api/events), sí se puede leer la respuesta.
    _puedeLeerRespuesta() {
      try {
        var u = new URL(this.url, global.location.href);
        return u.origin === global.location.origin || /\/api\/events$/.test(u.pathname);
      } catch (e) { return false; }
    }

    _programar(ms) {
      if (this._timer || !this.url || this._cola.length === 0) return;
      var self = this;
      this._timer = setTimeout(function () { self._timer = null; self._enviar(); }, ms);
    }

    async _enviar() {
      if (this._enviando || this._cola.length === 0 || !this.url) return;
      this._enviando = true;
      var lote = this._cola.splice(0, 50);
      try {
        if (this._puedeLeerRespuesta()) {
          // A través de la consola (que sí tiene CORS): se puede ver si GameStats aceptó el lote.
          var r = await fetch(this.url, {
            method: "POST", keepalive: true,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(lote)
          });
          if (r.status >= 500) throw new Error("GameStats respondió " + r.status);   // reintentar
        } else {
          // Directo a GameStats ingest, que no tiene CORS. Con "text/plain" + "no-cors" el
          // navegador envía el POST sin pedir permiso; ingest lee el JSON igual.
          await fetch(this.url, {
            method: "POST", mode: "no-cors", keepalive: true,
            headers: { "Content-Type": "text/plain" },
            body: JSON.stringify(lote)
          });
        }
        this._fallos = 0;
        this.enviados += lote.length;
      } catch (e) {
        this._cola = lote.concat(this._cola);   // se reintenta después
        this._fallos++;
      }
      this._enviando = false;
      this.emitir("estado", this.resumen());
      var espera = this._fallos ? Math.min(30000, 1000 * Math.pow(2, this._fallos)) : 50;
      this._programar(espera);
    }
  }

  // ---------------- TEMPLATE METHOD ----------------
  class JuegoBase extends Emisor {
    constructor(opciones) {
      super();
      if (new.target === JuegoBase) throw new Error("JuegoBase es abstracta");
      this.gameId = opciones.gameId;
      this.gameVersion = opciones.gameVersion || "1.0";
      this.enviador = opciones.enviador || new EnviadorEventos(null);
      this.matchId = null;
      this.jugadores = [];
      this.estado = "esperando";            // esperando | jugando | terminado
      this._inicio = 0;
      var self = this;
      global.addEventListener("beforeunload", function () {
        if (self.estado === "jugando") self.terminar(null, { reason: "abandoned" });
      });
    }

    // Pasos fijos (iguales para cualquier juego)
    iniciar(jugadores, modo) {
      if (this.estado === "jugando") this.terminar(null, { reason: "restarted" });
      this.matchId = this.gameId + "-" + nuevoId();     // único aunque haya muchas pestañas
      this.jugadores = jugadores;
      this.estado = "jugando";
      this._inicio = Date.now();
      // El juego DECLARA sus estadísticas: GameStats las calcula sin conocer el juego (dinámico).
      this.sistema("MATCH_STARTED", null, {
        players: jugadores.map(function (j) { return j.id; }),
        mode: modo || "2-jugadores",
        metrics: this.estadisticas()
      });
      var self = this;
      jugadores.forEach(function (j) { self.sistema("PLAYER_JOINED", j.id, { name: j.nombre }); });
      this.alIniciar();                                  // paso propio de cada juego
      this.emitir("inicio", this.matchId);
    }

    terminar(ganadorId, extra) {
      if (this.estado !== "jugando") return;
      this.estado = "terminado";
      var self = this;
      if (ganadorId) {
        this.jugadores.forEach(function (j) {
          var gano = j.id === ganadorId;
          self.accion(j.id, gano ? "PLAYER_WON" : "PLAYER_LOST", { result: gano ? "win" : "loss" });
        });
      }
      this.sistema("MATCH_FINISHED", null, Object.assign({ winner: ganadorId || "", durationMs: Date.now() - this._inicio }, extra || {}));
      this.alTerminar(ganadorId);                        // paso propio de cada juego
      this.emitir("fin", ganadorId);
    }

    accion(playerId, action, data) { return this._evento("GAMEPLAY", action, playerId, data); }
    sistema(action, playerId, data) { return this._evento("SYSTEM", action, playerId, data); }

    _evento(type, action, playerId, data) {
      var e = {
        eventId: nuevoId(),
        timestamp: new Date().toISOString(),
        gameId: this.gameId,
        gameVersion: this.gameVersion,
        matchId: this.matchId,
        type: type,
        action: action
      };
      if (playerId) e.playerId = playerId;
      if (data) e.data = data;
      this.enviador.agregar(e);
      this.emitir("evento", e);
      avisarConsola("evento", { evento: e });
      return e;
    }

    // Pasos que cada juego DEBE / PUEDE redefinir
    alIniciar() { throw new Error("Cada juego debe implementar alIniciar()"); }
    alTerminar() {}

    /*
     * Estadísticas ESPECÍFICAS del juego, declaradas como datos (no como código).
     * GameStats las interpreta con un analizador genérico, así que un juego nuevo trae
     * las suyas sin que haya que tocar ni recompilar GameStats. Cada una es:
     *   { id, label, op, action?, where?, field?, player?, of?, over?, scope?, record? }
     *   op: count | sum | max | min | avg | last | pct | countBy
     *   player: campo de data que dice a quién se le cuenta (por defecto, el playerId)
     *   scope: "player" (por jugador) o "match" (de la partida)
     *   record: "max" | "min" → GameStats guarda el mejor valor como récord
     * Las estadísticas GENERALES (ganador, victorias, récords, tiempo) salen solas del
     * contrato común: MATCH_FINISHED.data.winner y MATCH_FINISHED.data.scores.
     */
    estadisticas() { return []; }
  }

  if (EN_CONSOLA) global.document.documentElement.classList.add("en-consola");

  global.GS = {
    Emisor: Emisor, EnviadorEventos: EnviadorEventos, JuegoBase: JuegoBase, aPlayerId: aPlayerId,
    params: PARAMS, enConsola: EN_CONSOLA, avisarConsola: avisarConsola
  };
})(window);
