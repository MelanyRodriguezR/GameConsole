/*
 * main.js — La vista de Adivina el Número y el arranque.
 * Aquí no hay reglas: solo se muestra lo que dice el juego y se le pasa lo que escriben.
 */
(function () {
  "use strict";

  var $ = Pagina.$;
  var juego = new JuegoAdivinanza(Pagina.crearEnviador("adivinanza"));
  Pagina.conectarBitacora(juego);

  var entrada = $("entrada"), botonEnviar = $("enviar");

  function escapar(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; });
  }

  function textoPista(p) {
    return p === "correct" ? "✅ ¡correcto!" : (p === "higher" ? "⬆️ es MAYOR" : "⬇️ es MENOR");
  }

  // OBSERVER: cada vez que el juego cambia, se vuelve a dibujar
  function mostrar(info) {
    var f = juego.fase;
    $("titulo-fase").textContent = f.titulo();
    $("error").textContent = (info && info.error) || "";
    entrada.type = f.secreta ? "password" : "text";
    entrada.placeholder = f.secreta ? "número secreto" : "tu intento";
    entrada.disabled = botonEnviar.disabled = !f.activa;
    if (!(info && info.error)) entrada.value = "";
    if (f.activa) entrada.focus(); else entrada.blur();

    juego.personas.forEach(function (p, i) {
      var col = $(i === 0 ? "col1" : "col2");
      col.className = "tarjeta columna" + (f.turnoDe() === i ? " turno" : "");
      var filas = p.intentos.map(function (t, k) {
        return "<li><b>" + (k + 1) + ".</b> " + t.numero + " → " + textoPista(t.pista) + "</li>";
      }).join("");
      col.innerHTML =
        "<h2 class='" + p.clase + "'>" + escapar(p.nombre) + (p.tieneSecreto ? " 🔒" : "") + "</h2>" +
        "<div class='rango'>Busca entre " + p.min + " y " + p.max + " · intentos: " + p.intentos.length + "</div>" +
        "<ol>" + (filas || "<li class='vacio'>sin intentos todavía</li>") + "</ol>";
    });
  }
  juego.on("cambio", mostrar);

  function bloquear(si) { $("nombre1").disabled = si; $("nombre2").disabled = si; }
  juego.on("inicio", function () { bloquear(true); $("iniciar").textContent = "↺ Reiniciar"; });
  juego.on("fin", function () { bloquear(false); $("iniciar").textContent = "▶ Jugar otra vez"; });

  function iniciar() { juego.iniciar(Pagina.leerJugadores(), "2-jugadores"); }

  $("iniciar").addEventListener("click", iniciar);
  ["nombre1", "nombre2"].forEach(function (id) {
    $(id).addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); iniciar(); } });
  });

  $("formulario").addEventListener("submit", function (e) {
    e.preventDefault();
    juego.enviar(entrada.value);
  });

  window.adivinanza = { juego: juego };      // para pruebas desde la consola del navegador
})();
