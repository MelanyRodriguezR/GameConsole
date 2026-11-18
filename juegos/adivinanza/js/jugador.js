/*
 * jugador.js — Un jugador de Adivina el Número.
 *
 * El número secreto es PRIVADO (#secreto): nadie lo puede leer desde afuera.
 * Solo se le puede preguntar comparar(n) → "higher" | "lower" | "correct".
 * Esto es ENCAPSULACIÓN: la regla "no se puede ver el secreto del otro" la
 * garantiza el propio objeto.
 */
(function (global) {
  "use strict";

  var MIN = 1, MAX = 100;

  class Jugador {
    #secreto = null;

    constructor(id, nombre, clase) {
      this.id = id;
      this.nombre = nombre;
      this.clase = clase;              // "p1" | "p2" (color en la página)
      this.intentos = [];              // [{ numero, pista }]
      this.min = MIN;                  // rango que le queda para adivinar al rival
      this.max = MAX;
    }

    get tieneSecreto() { return this.#secreto !== null; }

    elegirSecreto(n) {
      if (this.tieneSecreto) throw new Error("el secreto ya fue elegido");
      this.#secreto = n;
    }

    comparar(n) {
      if (n === this.#secreto) return "correct";
      return n < this.#secreto ? "higher" : "lower";
    }

    // Guarda un intento propio y achica el rango según la pista.
    anotar(numero, pista) {
      this.intentos.push({ numero: numero, pista: pista });
      if (pista === "higher") this.min = Math.max(this.min, numero + 1);
      if (pista === "lower") this.max = Math.min(this.max, numero - 1);
    }

    revelar() { return this.#secreto; }      // solo se usa al final de la partida
  }

  // "42" → 42 ; "hola", "3.5" o "500" → null
  function leerNumero(texto) {
    var limpio = String(texto == null ? "" : texto).trim();
    if (!/^\d+$/.test(limpio)) return null;
    var n = Number(limpio);
    return n >= MIN && n <= MAX ? n : null;
  }

  global.Jugador = Jugador;
  global.leerNumero = leerNumero;
  global.RANGO = { MIN: MIN, MAX: MAX };
})(window);
