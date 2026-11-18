/*
 * controles.js — Patrón STRATEGY.
 *
 * Un Control decide qué hace un luchador en cada cuadro. El luchador y el juego
 * NO saben quién lo maneja: puede ser una persona con el teclado (ControlTeclado)
 * o, más adelante, la computadora con Prolog (ControlIA). Cambiar de uno a otro
 * no obliga a tocar el resto del código.
 */
(function (global) {
  "use strict";

  // Clase base (abstracta)
  class Control {
    // Debe devolver { izq, der, saltar, bloquear, golpe, patada }
    decidir(yo, rival, juego) { throw new Error("decidir() no implementado"); }
  }

  // ---- Estado del teclado, compartido por los dos jugadores ----
  var presionadas = new Set();   // teclas que están abajo AHORA
  var pulsaciones = {};          // cuántas veces se ha presionado cada tecla (para no perder toques rápidos)

  function escribiendo(e) {
    var t = e.target && e.target.tagName;
    return t === "INPUT" || t === "SELECT" || t === "TEXTAREA";
  }

  global.addEventListener("keydown", function (e) {
    if (escribiendo(e)) return;               // si escriben su nombre, no mover al luchador
    presionadas.add(e.code);
    if (!e.repeat) pulsaciones[e.code] = (pulsaciones[e.code] || 0) + 1;
    // Que las flechas y la barra no muevan la página
    if (e.code.indexOf("Arrow") === 0 || e.code === "Space") e.preventDefault();
  });
  global.addEventListener("keyup", function (e) { presionadas.delete(e.code); });
  global.addEventListener("blur", function () { presionadas.clear(); });

  class ControlTeclado extends Control {
    // teclas = { izq, der, saltar, bloquear, golpe, patada } con códigos como "KeyA"
    constructor(teclas) {
      super();
      this.teclas = teclas;
      this._vistas = Object.assign({}, pulsaciones);   // lo presionado antes de crearlo no cuenta
    }

    // true si la tecla se presionó desde el cuadro anterior (aunque ya la hayan soltado)
    _nueva(codigo) {
      var total = pulsaciones[codigo] || 0;
      var nueva = total > (this._vistas[codigo] || 0);
      this._vistas[codigo] = total;
      return nueva;
    }

    // abajo ahora, o tocada rapidísimo entre dos cuadros
    _activa(codigo) { return this._nueva(codigo) || presionadas.has(codigo); }

    decidir() {
      var t = this.teclas;
      return {
        izq: this._activa(t.izq), der: this._activa(t.der),
        saltar: this._activa(t.saltar), bloquear: this._activa(t.bloquear),
        // un ataque por cada vez que se PRESIONA la tecla (mantenerla no repite)
        golpe: this._nueva(t.golpe),
        patada: this._nueva(t.patada)
      };
    }
  }

  var TECLAS = {
    jugador1: { izq: "KeyA", der: "KeyD", saltar: "KeyW", bloquear: "KeyS", golpe: "KeyF", patada: "KeyG" },
    jugador2: { izq: "ArrowLeft", der: "ArrowRight", saltar: "ArrowUp", bloquear: "ArrowDown", golpe: "KeyK", patada: "KeyL" }
  };

  /*
   * ControlIA — la computadora. Otra estrategia del mismo patrón STRATEGY.
   *
   * También es un ADAPTER entre el juego y Prolog:
   *   - _estado()   traduce lo que pasa en el juego a los datos que entiende Prolog,
   *   - _traducir() convierte la respuesta de Prolog ("acercarse", "patada"...) en una
   *                 orden del luchador { izq, der, saltar, bloquear, golpe, patada }.
   *
   * Las preguntas a Prolog son asíncronas: el juego nunca se detiene a esperar la respuesta.
   * Mientras llega la siguiente, el luchador sigue con la última decisión.
   */
  class ControlIA extends Control {
    constructor(urlProlog, cadaMs) {
      super();
      this.url = String(urlProlog || "http://localhost:8081").replace(/\/+$/, "") + "/combate/decision";
      this.cadaMs = cadaMs || 100;
      this.decision = { accion: "esperar", razon: "todavía no he pensado" };
      this.conectado = null;          // null = aún no se sabe · true · false
      this.decisiones = 0;
      this._pidiendo = false;
      this._ultimaPregunta = 0;
      this._ataqueUsado = false;
      this._ultimaEnviada = null;
      this.alCambiar = null;          // function(control) para que la página muestre el estado
    }

    decidir(yo, rival, juego) {
      var ahora = performance.now();
      if (!this._pidiendo && ahora - this._ultimaPregunta >= this.cadaMs) {
        this._ultimaPregunta = ahora;
        this._preguntar(this._estado(yo, rival, juego), yo, juego);
      }
      return this._traducir(this.decision.accion, yo, rival);
    }

    _estado(yo, rival, juego) {
      var margen = 30;
      return {
        distancia: Math.round(Math.abs(rival.centro - yo.centro)),
        miVida: yo.vida,
        rivalVida: rival.vida,
        miEspera: Math.round(yo.espera * 100) / 100,
        rivalAtacando: rival.ocupado && rival.ataque ? rival.ataque : "ninguno",
        rivalBloqueando: rival.bloqueando,
        rivalEnAire: !rival.enSuelo,
        // ¿tengo la pared detrás? (miro hacia el rival, así que "detrás" es el lado contrario)
        enEsquina: yo.mira === 1 ? yo.x < margen : yo.x > global.CONST.ANCHO - yo.ancho - margen,
        tiempo: Math.round(juego.tiempo)
      };
    }

    async _preguntar(estado, yo, juego) {
      this._pidiendo = true;
      try {
        var r = await fetch(this.url, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(estado), signal: AbortSignal.timeout(1500)
        });
        var d = await r.json();
        if (!r.ok || !d.accion) throw new Error(d.error || "respuesta inválida");
        var cambio = d.accion !== this.decision.accion;
        if (cambio || d.accion === "golpe" || d.accion === "patada") this._ataqueUsado = false;
        this.decision = { accion: d.accion, razon: d.razon, ms: d.ms, estado: estado };
        this.decisiones++;
        this.conectado = true;
        // Evento para GameStats solo cuando la decisión cambia (para no inundarlo)
        if (cambio && juego.estado === "jugando" && this._ultimaEnviada !== d.accion) {
          this._ultimaEnviada = d.accion;
          juego.accion(yo.id, "AI_DECISION", {
            decision: d.accion, reason: d.razon, engine: "swi-prolog",
            distance: estado.distancia, hp: estado.miVida, rivalHp: estado.rivalVida, round: juego.ronda
          });
        }
      } catch (e) {
        this.conectado = false;
        this.decision = { accion: "esperar", razon: "sin conexión con Prolog (" + e.message + ")" };
      }
      this._pidiendo = false;
      if (this.alCambiar) this.alCambiar(this);
    }

    _traducir(accion, yo, rival) {
      var haciaRival = rival.centro >= yo.centro ? "der" : "izq";
      var lejos = haciaRival === "der" ? "izq" : "der";
      var o = { izq: false, der: false, saltar: false, bloquear: false, golpe: false, patada: false };
      switch (accion) {
        case "acercarse": o[haciaRival] = true; break;
        case "alejarse":  o[lejos] = true; break;
        case "saltar":    o.saltar = true; o[haciaRival] = true; break;   // saltar por encima para salir de la esquina
        case "bloquear":  o.bloquear = true; break;
        case "golpe":
        case "patada":
          if (!this._ataqueUsado) { o[accion] = true; this._ataqueUsado = true; }
          break;
        default: break;   // esperar
      }
      return o;
    }
  }

  global.Control = Control;
  global.ControlTeclado = ControlTeclado;
  global.ControlIA = ControlIA;
  global.TECLAS = TECLAS;
  global._teclasPresionadas = presionadas;   // solo para pruebas
})(window);
