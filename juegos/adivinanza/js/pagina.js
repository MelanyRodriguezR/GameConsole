/*
 * pagina.js — Partes de la página que no son reglas del juego:
 *   - el selector "Enviar a" (GameStats local / Render / no enviar),
 *   - el aviso de si los eventos llegan,
 *   - la bitácora con los eventos enviados.
 * Dentro de la consola, la consola decide a dónde van los eventos (?gamestats=...).
 */
(function (global) {
  "use strict";

  var DESTINOS = {
    local:  "http://localhost:8080/events",
    render: "https://gamestats-ingest.onrender.com/events",
    off:    null
  };

  function $(id) { return document.getElementById(id); }

  function crearEnviador(clave) {
    var p = GS.params.get("gamestats");
    var inicial = p ? (p === "off" ? "off" : p) : (function () {
      try { return localStorage.getItem(clave + ".destino") || "local"; } catch (e) { return "local"; }
    })();
    var urlDe = function (v) { return v in DESTINOS ? DESTINOS[v] : v; };
    var enviador = new GS.EnviadorEventos(urlDe(inicial));

    var selector = $("destino");
    if (selector) {
      if (!(inicial in DESTINOS)) {
        var op = document.createElement("option"); op.value = inicial; op.textContent = inicial;
        selector.appendChild(op);
      }
      selector.value = inicial;
      selector.addEventListener("change", function () {
        try { localStorage.setItem(clave + ".destino", selector.value); } catch (e) {}
        enviador.cambiarDestino(urlDe(selector.value));
        selector.blur();
      });
    }

    function mostrar(s) {
      var el = $("estado-gs");
      if (!s.url) { el.textContent = "No se envían eventos (solo se muestran aquí)."; el.className = ""; return; }
      if (s.ok) {
        el.textContent = "✔ Conectado · enviados: " + s.enviados + (s.pendientes ? " · en cola: " + s.pendientes : "");
        el.className = "ok";
      } else {
        el.textContent = "⚠ GameStats no responde. El juego sigue normal; " + s.pendientes + " eventos esperan y se reintenta solo.";
        el.className = "error";
      }
    }
    enviador.on("estado", mostrar);
    mostrar(enviador.resumen());
    if (enviador.url) $("estado-gs").textContent = "Listo para enviar a " + enviador.url;
    return enviador;
  }

  function conectarBitacora(juego) {
    juego.on("evento", function (e) {
      var li = document.createElement("li");
      li.className = e.type === "SYSTEM" ? "sistema" : "";
      li.textContent = e.timestamp.slice(11, 19) + "  " + e.action + (e.playerId ? " · " + e.playerId : "") +
        (e.data ? " " + JSON.stringify(e.data) : "");
      $("bitacora").prepend(li);
      while ($("bitacora").children.length > 80) $("bitacora").lastChild.remove();
    });
    juego.on("inicio", function (id) { $("partida").textContent = "Partida: " + id; });
  }

  // Lee los dos nombres y arma ids distintos ("Ana López" → "ana-lopez")
  function leerJugadores() {
    var n1 = $("nombre1").value.trim() || "Jugador 1";
    var n2 = $("nombre2").value.trim() || "Jugador 2";
    var id1 = GS.aPlayerId(n1, "jugador1"), id2 = GS.aPlayerId(n2, "jugador2");
    if (id1 === id2) id2 += "-2";
    return [{ id: id1, nombre: n1 }, { id: id2, nombre: n2 }];
  }

  global.Pagina = { crearEnviador: crearEnviador, conectarBitacora: conectarBitacora, leerJugadores: leerJugadores, $: $ };
})(window);
