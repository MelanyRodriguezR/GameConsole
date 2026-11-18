/*
 * teclado.js — Lee el teclado para los dos jugadores.
 *
 * Guarda las teclas que están abajo y cuántas veces se presionó cada una,
 * para que un toque muy rápido (entre dos cuadros del juego) no se pierda.
 * Si el foco está en un campo de texto, las teclas NO mueven las canastas.
 */
(function (global) {
  "use strict";

  var abajo = new Set();
  var pulsaciones = {};

  function escribiendo(e) {
    var t = e.target && e.target.tagName;
    return t === "INPUT" || t === "SELECT" || t === "TEXTAREA";
  }

  global.addEventListener("keydown", function (e) {
    if (escribiendo(e)) return;
    abajo.add(e.code);
    if (!e.repeat) pulsaciones[e.code] = (pulsaciones[e.code] || 0) + 1;
    if (e.code.indexOf("Arrow") === 0 || e.code === "Space") e.preventDefault();
  });
  global.addEventListener("keyup", function (e) { abajo.delete(e.code); });
  global.addEventListener("blur", function () { abajo.clear(); });

  // Un lector por jugador: recuerda qué pulsaciones ya atendió.
  class LectorTeclas {
    constructor(teclas) {
      this.teclas = teclas;                         // { izq: "KeyA", der: "KeyD" }
      this._vistas = Object.assign({}, pulsaciones);
    }
    activa(nombre) {
      var codigo = this.teclas[nombre];
      var total = pulsaciones[codigo] || 0;
      var nueva = total > (this._vistas[codigo] || 0);
      this._vistas[codigo] = total;
      return nueva || abajo.has(codigo);
    }
  }

  global.LectorTeclas = LectorTeclas;
  global.TECLAS = {
    jugador1: { izq: "KeyA", der: "KeyD" },
    jugador2: { izq: "ArrowLeft", der: "ArrowRight" }
  };
})(window);
