/*
 * atrapar.js — JuegoAtrapar: las reglas de Atrapa Estrellas.
 *
 * Hereda de JuegoBase (TEMPLATE METHOD): JuegoBase ya manda MATCH_STARTED,
 * PLAYER_JOINED, PLAYER_WON/LOST y MATCH_FINISHED. Aquí solo va lo propio.
 *
 * Reglas: 60 segundos; gana quien tenga más puntos (puede haber empate).
 * Evento propio:  ITEM_CAUGHT { item, points, score, stunned }
 */
(function (global) {
  "use strict";

  var M = global.MEDIDAS;
  var DURACION = 60;

  class JuegoAtrapar extends GS.JuegoBase {
    constructor(canvas, enviador) {
      super({ gameId: "atrapar", gameVersion: "1.0", enviador: enviador });
      this.ctx = canvas.getContext("2d");
      this.fabrica = new FabricaObjetos();
      this.canastas = null;
      this.objetos = [];
      this.mensaje = "Escriban sus nombres y presionen  ▶ Iniciar";
      this._cuadro = this._cuadro.bind(this);
      this._dibujar();
    }

    // jugadores = [{ id, nombre, lector }, { id, nombre, lector }]
    alIniciar() {
      var a = this.jugadores[0], b = this.jugadores[1];
      this.canastas = [
        new Canasta(a.id, a.nombre, "#4fc3f7", 170, a.lector),
        new Canasta(b.id, b.nombre, "#ff8a65", M.ANCHO - 270, b.lector)
      ];
      this.objetos = [];
      this.perdidos = 0;
      this.tiempo = DURACION;
      this.proximo = 0;
      this.pausa = 1.5;                    // cuenta regresiva
      cancelAnimationFrame(this._raf);
      this._ultimo = performance.now();
      this._raf = requestAnimationFrame(this._cuadro);
    }

    alTerminar() {}

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
        this.mensaje = this.pausa > 0.4 ? "Prepárense… " + Math.ceil(this.pausa) : "¡YA!";
        if (this.pausa <= 0) this.mensaje = "";
        return;
      }

      var self = this;
      this.tiempo = Math.max(0, this.tiempo - dt);
      var dificultad = 1 - this.tiempo / DURACION;

      this.proximo -= dt;
      if (this.proximo <= 0) {
        this.objetos.push(this.fabrica.crear(dificultad));
        this.proximo = 0.75 - dificultad * 0.45;
      }

      this.canastas.forEach(function (k) { k.mover(dt); });

      this.objetos = this.objetos.filter(function (o) {
        o.caer(dt);
        var k = self.canastas.find(function (k) { return !k.aturdida && k.atrapa(o); });
        if (k) {
          o.alAtrapar(k);                 // polimorfismo: cada objeto sabe su efecto
          k.atrapados++;
          self.accion(k.id, "ITEM_CAUGHT", { item: o.nombre, points: o.puntos, score: k.puntos, stunned: k.aturdida });
          return false;
        }
        if (o.fuera) { if (o.bueno) self.perdidos++; return false; }
        return true;
      });

      if (this.tiempo === 0) this._finalizar();
    }

    _finalizar() {
      var A = this.canastas[0], B = this.canastas[1];
      var ganador = A.puntos === B.puntos ? null : (A.puntos > B.puntos ? A : B);
      this.mensaje = ganador ? "🏆 ¡" + ganador.nombre + " gana con " + ganador.puntos + " puntos!" : "🤝 ¡Empate a " + A.puntos + "!";
      var puntajes = {};
      this.canastas.forEach(function (k) { puntajes[k.id] = k.puntos; });
      this.terminar(ganador ? ganador.id : null, { scores: puntajes, missed: this.perdidos, draw: !ganador });
    }

    _dibujar() {
      var c = this.ctx;
      c.clearRect(0, 0, M.ANCHO, M.ALTO);
      c.fillStyle = "#1a1d2b"; c.fillRect(0, M.ALTO - 18, M.ANCHO, 18);

      if (this.canastas) {
        this.objetos.forEach(function (o) { o.dibujar(c); });
        this.canastas.forEach(function (k) { k.dibujar(c); });
        c.textBaseline = "alphabetic";
        c.font = "bold 20px Segoe UI, sans-serif";
        c.textAlign = "left"; c.fillStyle = this.canastas[0].color;
        c.fillText(this.canastas[0].nombre + ": " + this.canastas[0].puntos, 16, 32);
        c.textAlign = "right"; c.fillStyle = this.canastas[1].color;
        c.fillText(this.canastas[1].nombre + ": " + this.canastas[1].puntos, M.ANCHO - 16, 32);
        c.textAlign = "center"; c.fillStyle = this.tiempo <= 10 ? "#e57373" : "#e8e9f0";
        c.fillText("⏱ " + Math.ceil(this.tiempo), M.ANCHO / 2, 32);
      }

      if (this.mensaje) {
        c.fillStyle = "rgba(0,0,0,.6)"; c.fillRect(0, 205, M.ANCHO, 64);
        c.fillStyle = "#ffffff"; c.font = "bold 24px Segoe UI, sans-serif";
        c.textAlign = "center"; c.textBaseline = "middle";
        c.fillText(this.mensaje, M.ANCHO / 2, 237);
        c.textBaseline = "alphabetic";
      }
    }
  }

  global.JuegoAtrapar = JuegoAtrapar;
})(window);
