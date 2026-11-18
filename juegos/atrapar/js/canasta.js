/*
 * canasta.js — La canasta que mueve cada jugador.
 * Los puntos son PRIVADOS (#puntos): solo cambian con sumar() (ENCAPSULACIÓN).
 */
(function (global) {
  "use strict";

  var M = global.MEDIDAS;
  var VELOCIDAD = 440;

  class Canasta {
    #puntos = 0;

    constructor(id, nombre, color, x, lector) {
      this.id = id;
      this.nombre = nombre;
      this.color = color;
      this.lector = lector;          // de dónde salen las órdenes (teclado)
      this.ancho = 100;
      this.alto = 26;
      this.x = x;
      this.y = M.ALTO - 46;
      this._aturdida = 0;
      this.atrapados = 0;
      this.bombas = 0;
    }

    get puntos() { return this.#puntos; }
    get aturdida() { return this._aturdida > 0; }

    sumar(p) { this.#puntos = Math.max(0, this.#puntos + p); }
    aturdir(segundos) { this._aturdida = segundos; this.bombas++; }

    mover(dt) {
      this._aturdida = Math.max(0, this._aturdida - dt);
      var izq = this.lector.activa("izq"), der = this.lector.activa("der");
      if (this.aturdida) return;
      var dx = (der ? 1 : 0) - (izq ? 1 : 0);
      this.x = Math.max(0, Math.min(M.ANCHO - this.ancho, this.x + dx * VELOCIDAD * dt));
    }

    atrapa(o) {
      return o.y + o.radio >= this.y && o.y - o.radio <= this.y + this.alto &&
             o.x >= this.x - 4 && o.x <= this.x + this.ancho + 4;
    }

    dibujar(c) {
      c.save();
      c.globalAlpha = this.aturdida ? 0.4 : 1;
      c.fillStyle = this.color;
      c.beginPath();
      c.moveTo(this.x, this.y);
      c.lineTo(this.x + this.ancho, this.y);
      c.lineTo(this.x + this.ancho - 12, this.y + this.alto);
      c.lineTo(this.x + 12, this.y + this.alto);
      c.closePath();
      c.fill();
      c.fillStyle = "#14161f";
      c.font = "bold 13px Segoe UI, sans-serif";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(this.aturdida ? "💫" : this.nombre.slice(0, 11), this.x + this.ancho / 2, this.y + 13);
      c.restore();
    }
  }

  global.Canasta = Canasta;
})(window);
