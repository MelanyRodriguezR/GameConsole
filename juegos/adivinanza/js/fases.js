/*
 * fases.js — Patrón STATE.
 *
 * La partida pasa por fases. Cada fase es un objeto que sabe:
 *   - qué mensaje mostrar (titulo),
 *   - si el campo de texto es secreto o no (secreta),
 *   - qué hacer con lo que escribe el jugador (enviar).
 * El juego no tiene un "if (fase === ...)" gigante: solo delega en la fase actual.
 *
 *   FaseSecreto(0) → FaseSecreto(1) → FaseAdivinar(0) ⇄ FaseAdivinar(1) → FaseFin
 *
 * Regla justa: si el jugador 1 adivina, el jugador 2 tiene una ÚLTIMA oportunidad
 * para empatar (así los dos tienen la misma cantidad de intentos).
 */
(function (global) {
  "use strict";

  var R = global.RANGO;
  var ERROR_NUMERO = "Escribe un número entero del " + R.MIN + " al " + R.MAX + ".";

  class Fase {
    constructor(juego) { this.juego = juego; }
    titulo() { return ""; }
    get secreta() { return false; }
    get activa() { return true; }
    turnoDe() { return -1; }
    enviar(texto) { return null; }      // devuelve un mensaje de error o null
  }

  class FaseSecreto extends Fase {
    constructor(juego, indice) { super(juego); this.indice = indice; }
    get jugador() { return this.juego.personas[this.indice]; }
    get secreta() { return true; }
    titulo() {
      return "🤫 " + this.jugador.nombre + ", escribe tu número secreto (" + R.MIN + "–" + R.MAX + "). ¡Que el otro no mire!";
    }
    enviar(texto) {
      var n = leerNumero(texto);
      if (n === null) return ERROR_NUMERO;
      this.jugador.elegirSecreto(n);
      this.juego.accion(this.jugador.id, "SECRET_CHOSEN", { range: R.MIN + "-" + R.MAX });
      this.juego.cambiarFase(this.indice === 0 ? new FaseSecreto(this.juego, 1) : new FaseAdivinar(this.juego, 0, false));
      return null;
    }
  }

  class FaseAdivinar extends Fase {
    constructor(juego, turno, ultimaOportunidad) {
      super(juego);
      this.turno = turno;
      this.ultimaOportunidad = ultimaOportunidad;
    }
    get yo() { return this.juego.personas[this.turno]; }
    get rival() { return this.juego.personas[1 - this.turno]; }
    turnoDe() { return this.turno; }
    titulo() {
      return (this.ultimaOportunidad ? "⚠️ ¡Última oportunidad para empatar! " : "🎯 Turno de ") +
        this.yo.nombre + ": adivina el número de " + this.rival.nombre +
        " (entre " + this.yo.min + " y " + this.yo.max + ")";
    }
    enviar(texto) {
      var n = leerNumero(texto);
      if (n === null) return ERROR_NUMERO;
      var pista = this.rival.comparar(n);
      this.yo.anotar(n, pista);
      this.juego.accion(this.yo.id, "GUESS", {
        targetId: this.rival.id, guess: n, result: pista, attempt: this.yo.intentos.length
      });

      var J = this.juego;
      if (this.ultimaOportunidad) J.finalizar(pista === "correct" ? null : J.personas[0]);
      else if (pista === "correct" && this.turno === 0) J.cambiarFase(new FaseAdivinar(J, 1, true));
      else if (pista === "correct") J.finalizar(this.yo);
      else J.cambiarFase(new FaseAdivinar(J, 1 - this.turno, false));
      return null;
    }
  }

  class FaseFin extends Fase {
    constructor(juego, ganador) { super(juego); this.ganador = ganador; }
    get activa() { return false; }
    titulo() {
      var P = this.juego.personas;
      var secretos = " (secretos: " + P[0].nombre + " = " + P[0].revelar() + ", " + P[1].nombre + " = " + P[1].revelar() + ")";
      return (this.ganador
        ? "🏆 ¡" + this.ganador.nombre + " gana en " + this.ganador.intentos.length + " intentos!"
        : "🤝 ¡Empate!") + secretos;
    }
    enviar() { return "La partida terminó. Presiona ▶ Jugar otra vez."; }
  }

  global.Fases = { Fase: Fase, FaseSecreto: FaseSecreto, FaseAdivinar: FaseAdivinar, FaseFin: FaseFin };
})(window);
