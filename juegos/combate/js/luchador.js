/*
 * luchador.js — La clase Luchador.
 *
 * Un luchador sabe: dónde está, hacia dónde mira, cuánta vida tiene,
 * si está golpeando / pateando / bloqueando, y cómo dibujarse.
 * La vida es PRIVADA (#vida): solo baja con recibirGolpe(), así nadie puede
 * "hacer trampa" cambiándola desde afuera (ENCAPSULACIÓN).
 */
(function (global) {
  "use strict";

  var C = {
    ANCHO: 800, ALTO: 420, SUELO: 360,
    VELOCIDAD: 250, SALTO: 650, GRAVEDAD: 1750,
    VIDA_MAX: 100
  };

  // Tipos de ataque: alcance (px), daño, duración de la animación y espera hasta el siguiente.
  var ATAQUES = {
    golpe:  { alcance: 80,  dano: 8,  duracion: 0.15, espera: 0.35 },
    patada: { alcance: 105, dano: 14, duracion: 0.25, espera: 0.80 }
  };

  class Luchador {
    #vida = C.VIDA_MAX;

    constructor(id, nombre, color, xInicial, miraInicial) {
      this.id = id;
      this.nombre = nombre;
      this.color = color;
      this.xInicial = xInicial;
      this.miraInicial = miraInicial;
      this.ancho = 46;
      this.alto = 92;
      this.rondasGanadas = 0;
      this.reiniciar();
    }

    get vida() { return this.#vida; }
    get vivo() { return this.#vida > 0; }
    get centro() { return this.x + this.ancho / 2; }
    get enSuelo() { return this.y >= C.SUELO - this.alto; }
    get ocupado() { return this.animacion > 0; }

    reiniciar() {
      this.#vida = C.VIDA_MAX;
      this.x = this.xInicial;
      this.y = C.SUELO - this.alto;
      this.vy = 0;
      this.mira = this.miraInicial;      // 1 = derecha, -1 = izquierda
      this.ataque = null;                // "golpe" | "patada" | null
      this.animacion = 0;
      this.espera = 0;
      this.bloqueando = false;
      this.parpadeo = 0;
    }

    // Recibe un ataque. Si bloquea de frente, el daño baja mucho.
    recibirGolpe(atacante, tipo) {
      var info = ATAQUES[tipo];
      var deFrente = Math.sign(atacante.centro - this.centro) === this.mira;
      var bloqueado = this.bloqueando && deFrente;
      var dano = bloqueado ? Math.ceil(info.dano / 5) : info.dano;
      this.#vida = Math.max(0, this.#vida - dano);
      this.parpadeo = 0.15;
      this.x += atacante.mira * (bloqueado ? 6 : (tipo === "patada" ? 30 : 16));   // empujón
      this.x = Math.max(0, Math.min(C.ANCHO - this.ancho, this.x));
      return { dano: dano, bloqueado: bloqueado };
    }

    // orden = { izq, der, saltar, bloquear, golpe, patada }
    // Devuelve el tipo de ataque que empezó en este cuadro (o null).
    actualizar(orden, rival, dt) {
      this.animacion = Math.max(0, this.animacion - dt);
      this.espera = Math.max(0, this.espera - dt);
      this.parpadeo = Math.max(0, this.parpadeo - dt);
      if (!this.ocupado) this.ataque = null;

      this.bloqueando = !!orden.bloquear && this.enSuelo && !this.ocupado;

      if (!this.bloqueando) {
        var dx = (orden.der ? 1 : 0) - (orden.izq ? 1 : 0);
        this.x += dx * C.VELOCIDAD * dt;
        if (orden.saltar && this.enSuelo) this.vy = -C.SALTO;
      }

      this.vy += C.GRAVEDAD * dt;
      this.y = Math.min(C.SUELO - this.alto, this.y + this.vy * dt);
      if (this.enSuelo) this.vy = 0;

      // No se pueden atravesar ni salir de la pantalla
      this.x = Math.max(0, Math.min(C.ANCHO - this.ancho, this.x));
      var separacion = 34;
      if (Math.abs(this.centro - rival.centro) < separacion && Math.abs(this.y - rival.y) < 60) {
        this.x = rival.centro - this.ancho / 2 - Math.sign(rival.centro - this.centro || this.mira) * separacion;
        this.x = Math.max(0, Math.min(C.ANCHO - this.ancho, this.x));
      }

      this.mira = rival.centro >= this.centro ? 1 : -1;   // siempre mira al rival

      var tipo = orden.patada ? "patada" : (orden.golpe ? "golpe" : null);
      if (tipo && this.espera === 0 && !this.bloqueando) {
        this.ataque = tipo;
        this.animacion = ATAQUES[tipo].duracion;
        this.espera = ATAQUES[tipo].espera;
        return tipo;
      }
      return null;
    }

    alcanzaA(rival, tipo) {
      var delante = Math.sign(rival.centro - this.centro) === this.mira;
      var distancia = Math.abs(rival.centro - this.centro);
      return delante && distancia <= ATAQUES[tipo].alcance && Math.abs(rival.y - this.y) < 60;
    }

    dibujar(c) {
      var x = this.x, y = this.y, w = this.ancho, m = this.mira, cx = x + w / 2;
      c.save();
      c.fillStyle = this.parpadeo > 0 ? "#ffffff" : this.color;

      c.beginPath(); c.arc(cx, y + 14, 14, 0, Math.PI * 2); c.fill();      // cabeza
      c.fillRect(x + 9, y + 30, w - 18, 40);                                // cuerpo

      // piernas (una se estira si patea)
      if (this.ataque === "patada") {
        c.fillRect(x + 9, y + 70, 10, 22);
        var largo = ATAQUES.patada.alcance - 20;
        c.fillRect(m === 1 ? cx : cx - largo, y + 62, largo, 11);
        c.fillStyle = "#ffd54f";
        c.fillRect(m === 1 ? cx + largo - 12 : cx - largo, y + 58, 12, 18);
        c.fillStyle = this.color;
      } else {
        c.fillRect(x + 9, y + 70, 10, 22);
        c.fillRect(x + w - 19, y + 70, 10, 22);
      }

      // brazo (se estira si golpea)
      if (this.ataque === "golpe") {
        var brazo = ATAQUES.golpe.alcance - 22;
        c.fillRect(m === 1 ? cx : cx - brazo, y + 38, brazo, 9);
        c.fillStyle = "#ffd54f";
        c.fillRect(m === 1 ? cx + brazo - 10 : cx - brazo, y + 34, 12, 17);
        c.fillStyle = this.color;
      } else {
        c.fillRect(m === 1 ? x + w - 12 : x, y + 36, 12, 9);
      }

      c.fillStyle = "#14161f";                                              // ojo
      c.fillRect(cx + m * 6 - 2, y + 10, 4, 4);

      if (this.bloqueando) {                                                // escudo
        c.strokeStyle = "#90caf9"; c.lineWidth = 5;
        var a = m === 1 ? 0 : Math.PI;
        c.beginPath(); c.arc(cx, y + 46, 42, a - 1, a + 1); c.stroke();
      }
      c.restore();
    }
  }

  global.Luchador = Luchador;
  global.CONST = C;
  global.ATAQUES = ATAQUES;
})(window);
