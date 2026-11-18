/*
 * adivinanza.js — JuegoAdivinanza.
 *
 * Hereda de JuegoBase (TEMPLATE METHOD) y delega cada jugada en la fase actual (STATE).
 * Avisa a la vista con el evento "cambio" (OBSERVER): el juego no toca la página.
 *
 * Eventos propios:  SECRET_CHOSEN { range }   GUESS { targetId, guess, result, attempt }
 */
(function (global) {
  "use strict";

  var F = global.Fases;

  class JuegoAdivinanza extends GS.JuegoBase {
    constructor(enviador) {
      super({ gameId: "adivinanza", gameVersion: "1.0", enviador: enviador });
      this.fase = null;
      this.personas = [];
    }

    alIniciar() {
      this.personas = [
        new Jugador(this.jugadores[0].id, this.jugadores[0].nombre, "p1"),
        new Jugador(this.jugadores[1].id, this.jugadores[1].nombre, "p2")
      ];
      this.cambiarFase(new F.FaseSecreto(this, 0));
    }

    alTerminar() {}

    // Lo que GameStats debe medir de este juego.
    estadisticas() {
      return [
        { id: "intentos",   label: "Intentos",               action: "GUESS", op: "count" },
        { id: "para_ganar", label: "Intentos para adivinar", action: "GUESS", where: { result: "correct" }, field: "attempt", op: "min", record: "min" },
        { id: "mayor",      label: "Pistas \"es MAYOR\"",    action: "GUESS", where: { result: "higher" }, op: "count" },
        { id: "menor",      label: "Pistas \"es MENOR\"",    action: "GUESS", where: { result: "lower" }, op: "count" },
        { id: "pistas",     label: "Pistas de la partida",   action: "GUESS", field: "result", op: "countBy", scope: "match" }
      ];
    }

    cambiarFase(fase) {
      this.fase = fase;
      this.emitir("cambio", { error: null });
    }

    // Lo que escribió el jugador → lo resuelve la fase actual
    enviar(texto) {
      if (!this.fase) return "Primero presiona ▶ Iniciar.";
      var error = this.fase.enviar(texto);
      if (error) this.emitir("cambio", { error: error });
      return error;
    }

    finalizar(ganador) {
      var intentos = {};
      this.personas.forEach(function (p) { intentos[p.id] = p.intentos.length; });
      this.terminar(ganador ? ganador.id : null, { draw: !ganador, attempts: intentos });
      this.cambiarFase(new F.FaseFin(this, ganador));
    }
  }

  global.JuegoAdivinanza = JuegoAdivinanza;
})(window);
