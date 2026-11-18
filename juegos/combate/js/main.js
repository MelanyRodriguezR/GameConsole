/*
 * main.js — Conecta la página (botones, campos, bitácora) con el juego.
 * Aquí no hay reglas del juego: solo la interfaz.
 */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };

  // ---- ¿A dónde se mandan los eventos? ----
  var DESTINOS = {
    local:  "http://localhost:8080/events",
    render: "https://gamestats-ingest.onrender.com/events",
    off:    null
  };

  function destinoInicial() {
    var p = new URLSearchParams(location.search).get("gamestats");   // la consola lo pasará así
    if (p) return p === "off" ? "off" : p;
    try { return localStorage.getItem("combate.destino") || "local"; } catch (e) { return "local"; }
  }

  function urlDe(valor) { return valor in DESTINOS ? DESTINOS[valor] : valor; }

  var enviador = new GS.EnviadorEventos(urlDe(destinoInicial()));
  var juego = new JuegoCombate($("lienzo"), enviador);

  // Selector de destino
  var selector = $("destino");
  var inicial = destinoInicial();
  if (!(inicial in DESTINOS)) {
    var op = document.createElement("option"); op.value = inicial; op.textContent = inicial;
    selector.appendChild(op);
  }
  selector.value = inicial;
  selector.addEventListener("change", function () {
    try { localStorage.setItem("combate.destino", selector.value); } catch (e) {}
    enviador.cambiarDestino(urlDe(selector.value));
    selector.blur();
  });

  // Estado del envío
  function mostrarEstado(s) {
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
  enviador.on("estado", mostrarEstado);
  mostrarEstado(enviador.resumen());
  if (enviador.url) $("estado-gs").textContent = "Listo para enviar a " + enviador.url;

  // Bitácora de eventos
  juego.on("evento", function (e) {
    var li = document.createElement("li");
    li.className = e.type === "SYSTEM" ? "sistema" : "";
    var d = e.data ? " " + JSON.stringify(e.data) : "";
    li.textContent = e.timestamp.slice(11, 19) + "  " + e.action + (e.playerId ? " · " + e.playerId : "") + d;
    $("bitacora").prepend(li);
    while ($("bitacora").children.length > 80) $("bitacora").lastChild.remove();
  });
  juego.on("inicio", function (id) { $("partida").textContent = "Partida: " + id; });

  // Mientras pelean, los campos se bloquean para que las teclas no escriban en ellos
  function bloquearCampos(si) {
    ["nombre1", "modo"].forEach(function (id) { $(id).disabled = si; });
    $("nombre2").disabled = si || contraComputadora();
  }
  juego.on("inicio", function () { bloquearCampos(true); $("iniciar").textContent = "↺ Reiniciar"; });
  juego.on("fin", function () { bloquearCampos(false); $("iniciar").textContent = "▶ Jugar otra vez"; });

  // ---- Modo: 2 jugadores o contra la computadora (IA en Prolog) ----
  var URL_PROLOG = GS.params.get("prolog") || "http://localhost:8081";
  var modoSel = $("modo");
  if (GS.params.get("modo") === "vs-computadora") modoSel.value = "vs-computadora";
  function contraComputadora() { return modoSel.value === "vs-computadora"; }
  function aplicarModo() {
    var ia = contraComputadora();
    $("nombre2").disabled = ia || juego.estado === "jugando";
    $("nombre2").placeholder = ia ? "Computadora (Prolog)" : "Jugador 2";
    $("tarjeta-ia").hidden = !ia;
    $("teclas-j2").hidden = ia;
    modoSel.blur();
  }
  modoSel.addEventListener("change", aplicarModo);
  aplicarModo();

  function mostrarIA(c) {
    var el = $("ia-estado");
    if (c.conectado === false) { el.className = "error"; el.textContent = "⚠ No hay conexión con Prolog (" + URL_PROLOG + "). La computadora se queda quieta."; }
    else { el.className = "ok"; el.textContent = "✔ Conectada a SWI-Prolog · decisiones: " + c.decisiones + (c.decision.ms != null ? " · " + c.decision.ms + " ms" : ""); }
    $("ia-accion").textContent = c.decision.accion;
    $("ia-razon").textContent = c.decision.razon;
    var e = c.decision.estado;
    $("ia-datos").textContent = e ? "distancia " + e.distancia + " px · mi vida " + e.miVida + " · rival " + e.rivalVida +
      " · rival ataca: " + e.rivalAtacando + (e.rivalBloqueando ? " · rival bloquea" : "") + (e.enEsquina ? " · en la esquina" : "") : "";
  }

  function iniciar() {
    var ia = contraComputadora();
    var n1 = $("nombre1").value.trim() || "Jugador 1";
    var n2 = ia ? "Computadora" : ($("nombre2").value.trim() || "Jugador 2");
    var id1 = GS.aPlayerId(n1, "jugador1"), id2 = ia ? "computadora" : GS.aPlayerId(n2, "jugador2");
    if (id1 === id2) id2 = id2 + "-2";
    var control2 = ia ? new ControlIA(URL_PROLOG) : new ControlTeclado(TECLAS.jugador2);
    if (ia) control2.alCambiar = mostrarIA;
    juego.iniciar([
      { id: id1, nombre: n1, control: new ControlTeclado(TECLAS.jugador1) },
      { id: id2, nombre: n2, control: control2 }
    ], ia ? "vs-computadora" : "2-jugadores");
    $("iniciar").blur();          // que la barra espaciadora no vuelva a "presionar" el botón
    $("lienzo").focus();
  }

  $("iniciar").addEventListener("click", iniciar);
  // Enter dentro de un nombre también inicia
  ["nombre1", "nombre2"].forEach(function (id) {
    $(id).addEventListener("keydown", function (e) { if (e.key === "Enter") iniciar(); });
  });

  window.combate = { juego: juego, enviador: enviador };   // para pruebas desde la consola del navegador
})();
