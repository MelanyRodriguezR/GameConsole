/*
 * main.js — Arranque de Atrapa Estrellas: conecta botones y campos con el juego.
 */
(function () {
  "use strict";

  var $ = Pagina.$;
  var juego = new JuegoAtrapar($("lienzo"), Pagina.crearEnviador("atrapar"));
  Pagina.conectarBitacora(juego);

  // Mientras juegan, los nombres se bloquean para que las teclas no escriban en ellos
  function bloquear(si) { $("nombre1").disabled = si; $("nombre2").disabled = si; }
  juego.on("inicio", function () { bloquear(true); $("iniciar").textContent = "↺ Reiniciar"; });
  juego.on("fin", function () { bloquear(false); $("iniciar").textContent = "▶ Jugar otra vez"; });

  function iniciar() {
    var j = Pagina.leerJugadores();
    j[0].lector = new LectorTeclas(TECLAS.jugador1);
    j[1].lector = new LectorTeclas(TECLAS.jugador2);
    juego.iniciar(j, "2-jugadores");
    $("iniciar").blur();
    $("lienzo").focus();
  }

  $("iniciar").addEventListener("click", iniciar);
  ["nombre1", "nombre2"].forEach(function (id) {
    $(id).addEventListener("keydown", function (e) { if (e.key === "Enter") iniciar(); });
  });

  window.atrapar = { juego: juego };      // para pruebas desde la consola del navegador
})();
