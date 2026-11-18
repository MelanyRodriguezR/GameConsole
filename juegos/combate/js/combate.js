/*
 * combate.js — JuegoCombate: las reglas del combate.
 *
 * Hereda de JuegoBase (TEMPLATE METHOD): JuegoBase ya se encarga de los eventos
 * MATCH_STARTED, PLAYER_JOINED, PLAYER_WON/LOST y MATCH_FINISHED. Aquí solo va
 * lo propio del combate: rondas, ataques y dibujo.
 *
 * Reglas: gana el combate quien gane 2 rondas. Una ronda termina cuando alguien
 * se queda sin vida (KO) o se acaba el tiempo (gana quien tenga más vida).
 *
 * Eventos propios que se envían a GameStats:
 *   ATTACK    { targetId, attack: golpe|patada, hit, blocked, damage, targetHp, round }
 *   ROUND_END { round, winnerId, reason: ko|tiempo, hp }
 */
(function (global) {
  "use strict";

  var C = global.CONST;
  var RONDAS_PARA_GANAR = 2, TIEMPO_RONDA = 60;

  class JuegoCombate extends GS.JuegoBase {
    constructor(canvas, enviador) {
      super({ gameId: "combate", gameVersion: "1.0", enviador: enviador });
      this.ctx = canvas.getContext("2d");
      this.luchadores = null;
      this.mensaje = "Escriban sus nombres y presionen  ▶ Iniciar";
      this._cuadro = this._cuadro.bind(this);
      this._dibujar();
    }

    // jugadores = [{ id, nombre, control }, { id, nombre, control }]
    alIniciar() {
      var a = this.jugadores[0], b = this.jugadores[1];
      this.luchadores = [
        new Luchador(a.id, a.nombre, "#4fc3f7", 150, 1),
        new Luchador(b.id, b.nombre, "#ff8a65", C.ANCHO - 196, -1)
      ];
      this.controles = [a.control, b.control];
      this.ronda = 0;
      this._nuevaRonda("");
      cancelAnimationFrame(this._raf);
      this._ultimo = performance.now();
      this._raf = requestAnimationFrame(this._cuadro);
    }

    alTerminar() { /* el último cuadro ya muestra al campeón */ }

    _nuevaRonda(anterior) {
      this.ronda++;
      this.luchadores.forEach(function (l) { l.reiniciar(); });
      this.tiempo = TIEMPO_RONDA;
      this.pausa = anterior ? 2.2 : 1.5;              // cuenta regresiva antes de pelear
      this.textoPrevio = anterior;
    }

    // Ciclo del juego: ~60 veces por segundo
    _cuadro(ahora) {
      var dt = Math.min(0.05, (ahora - this._ultimo) / 1000);
      this._ultimo = ahora;
      if (this.estado === "jugando") this._actualizar(dt);
      this._dibujar();
      if (this.estado === "jugando") this._raf = requestAnimationFrame(this._cuadro);
    }

    _actualizar(dt) {
      if (this.pausa > 0) {
        this.pausa -= dt;
        var n = Math.ceil(this.pausa);
        this.mensaje = (this.textoPrevio ? this.textoPrevio + "  ·  " : "") +
          "Ronda " + this.ronda + (this.pausa > 0.5 ? "  —  " + n : "  —  ¡A PELEAR!");
        if (this.pausa <= 0) this.mensaje = "";
        return;
      }

      var L = this.luchadores, self = this;
      L.forEach(function (yo, i) {
        var rival = L[1 - i];
        var orden = self.controles[i].decidir(yo, rival, self) || {};
        var ataque = yo.actualizar(orden, rival, dt);
        if (ataque) self._resolverAtaque(yo, rival, ataque);
      });

      this.tiempo -= dt;
      var caido = L.find(function (l) { return !l.vivo; });
      if (caido) {
        this._finDeRonda(L.find(function (l) { return l !== caido; }), "ko");
      } else if (this.tiempo <= 0) {
        this.tiempo = 0;
        var g = L[0].vida === L[1].vida ? null : (L[0].vida > L[1].vida ? L[0] : L[1]);
        this._finDeRonda(g, "tiempo");
      }
    }

    _resolverAtaque(atacante, rival, tipo) {
      var resultado = atacante.alcanzaA(rival, tipo) ? rival.recibirGolpe(atacante, tipo) : null;
      this.accion(atacante.id, "ATTACK", {
        targetId: rival.id,
        attack: tipo,
        hit: !!resultado,
        blocked: resultado ? resultado.bloqueado : false,
        damage: resultado ? resultado.dano : 0,
        targetHp: rival.vida,
        round: this.ronda
      });
    }

    _finDeRonda(ganador, motivo) {
      var L = this.luchadores;
      if (ganador) ganador.rondasGanadas++;
      var vidas = {};
      L.forEach(function (l) { vidas[l.id] = l.vida; });
      // GameStats exige playerId en eventos GAMEPLAY: va el ganador (o el jugador 1 si empatan)
      this.accion((ganador || L[0]).id, "ROUND_END", {
        round: this.ronda, winnerId: ganador ? ganador.id : "", reason: motivo, hp: vidas
      });

      var campeon = L.find(function (l) { return l.rondasGanadas >= RONDAS_PARA_GANAR; });
      if (campeon) {
        this.mensaje = "🏆 ¡" + campeon.nombre + " gana el combate!";
        this.terminar(campeon.id, { rounds: this.ronda, score: L[0].rondasGanadas + "-" + L[1].rondasGanadas });
        return;
      }
      var texto = ganador ? (motivo === "ko" ? "¡KO! " : "¡Tiempo! ") + ganador.nombre + " gana la ronda" : "Ronda empatada";
      this._nuevaRonda(texto);
    }

    // ---------------- dibujo ----------------
    _dibujar() {
      var c = this.ctx;
      c.clearRect(0, 0, C.ANCHO, C.ALTO);
      c.fillStyle = "#1a1d2b"; c.fillRect(0, C.SUELO, C.ANCHO, C.ALTO - C.SUELO);
      c.fillStyle = "#2c3250"; c.fillRect(0, C.SUELO, C.ANCHO, 4);

      if (this.luchadores) {
        var self = this;
        this.luchadores.forEach(function (l, i) { self._barraVida(l, i); });
        this.luchadores.forEach(function (l) { l.dibujar(c); });
        c.textAlign = "center";
        c.fillStyle = "#e8e9f0"; c.font = "bold 24px Segoe UI, sans-serif";
        c.fillText(Math.ceil(this.tiempo), C.ANCHO / 2, 40);
        c.fillStyle = "#9aa0b8"; c.font = "13px Segoe UI, sans-serif";
        c.fillText("Ronda " + this.ronda, C.ANCHO / 2, 60);
      }

      if (this.mensaje) {
        c.fillStyle = "rgba(0,0,0,.6)"; c.fillRect(0, 150, C.ANCHO, 64);
        c.fillStyle = "#ffffff"; c.font = "bold 24px Segoe UI, sans-serif"; c.textAlign = "center";
        c.fillText(this.mensaje, C.ANCHO / 2, 191);
      }
    }

    _barraVida(l, i) {
      var c = this.ctx, w = 300, x = i === 0 ? 20 : C.ANCHO - 20 - w;
      c.fillStyle = "#2a2e44"; c.fillRect(x, 22, w, 18);
      var lleno = w * l.vida / C.VIDA_MAX;
      c.fillStyle = l.vida > 30 ? l.color : "#e57373";
      c.fillRect(i === 0 ? x : x + w - lleno, 22, lleno, 18);
      c.fillStyle = "#e8e9f0"; c.font = "bold 14px Segoe UI, sans-serif";
      c.textAlign = i === 0 ? "left" : "right";
      var rondas = "★".repeat(l.rondasGanadas) + "☆".repeat(RONDAS_PARA_GANAR - l.rondasGanadas);
      c.fillText(i === 0 ? l.nombre + "  " + rondas : rondas + "  " + l.nombre, i === 0 ? x : x + w, 60);
    }
  }

  global.JuegoCombate = JuegoCombate;
})(window);
