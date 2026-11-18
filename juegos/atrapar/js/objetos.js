/*
 * objetos.js — Lo que cae del cielo.
 *
 *   Objeto (abstracta) → Estrella, Dorada, Bomba
 *     HERENCIA + POLIMORFISMO: el juego solo dice "o.alAtrapar(canasta)" y cada
 *     objeto sabe sus puntos, su efecto y cómo se dibuja.
 *   FabricaObjetos → patrón FACTORY: decide QUÉ objeto crear según probabilidades.
 *     Para agregar un objeto nuevo (ej. un corazón) basta una clase más y una línea aquí.
 */
(function (global) {
  "use strict";

  var ANCHO = 800, ALTO = 480;

  class Objeto {
    constructor(x, velocidad) {
      if (new.target === Objeto) throw new Error("Objeto es abstracta");
      this.x = x;
      this.y = -20;
      this.velocidad = velocidad;
      this.radio = 15;
    }
    get nombre() { throw new Error("nombre no definido"); }
    get icono() { return "?"; }
    get puntos() { return 0; }
    get bueno() { return this.puntos > 0; }
    get fuera() { return this.y - this.radio > ALTO; }

    caer(dt) { this.y += this.velocidad * dt; }
    alAtrapar(canasta) { canasta.sumar(this.puntos); }

    dibujar(c) {
      c.font = (this.radio * 2) + "px 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(this.icono, this.x, this.y);
    }
  }

  class Estrella extends Objeto {
    get nombre() { return "estrella"; }
    get icono() { return "⭐"; }
    get puntos() { return 1; }
  }

  class Dorada extends Objeto {
    constructor(x, v) { super(x, v * 1.35); this.radio = 17; }   // vale más, pero cae más rápido
    get nombre() { return "dorada"; }
    get icono() { return "🌟"; }
    get puntos() { return 3; }
  }

  class Bomba extends Objeto {
    get nombre() { return "bomba"; }
    get icono() { return "💣"; }
    get puntos() { return -2; }
    alAtrapar(canasta) {
      super.alAtrapar(canasta);
      canasta.aturdir(0.8);                                        // efecto extra
    }
  }

  class FabricaObjetos {
    constructor() {
      this.tipos = [
        { clase: Estrella, probabilidad: 0.60 },
        { clase: Dorada,   probabilidad: 0.12 },
        { clase: Bomba,    probabilidad: 0.28 }
      ];
    }
    // dificultad va de 0 (inicio) a 1 (final): las cosas caen cada vez más rápido
    crear(dificultad) {
      var r = Math.random(), acumulado = 0, Clase = Estrella;
      for (var i = 0; i < this.tipos.length; i++) {
        acumulado += this.tipos[i].probabilidad;
        if (r < acumulado) { Clase = this.tipos[i].clase; break; }
      }
      var x = 24 + Math.random() * (ANCHO - 48);
      return new Clase(x, 150 + dificultad * 170 + Math.random() * 60);
    }
  }

  global.Objeto = Objeto;
  global.FabricaObjetos = FabricaObjetos;
  global.MEDIDAS = { ANCHO: ANCHO, ALTO: ALTO };
})(window);
