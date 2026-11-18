/*
 * app.js — Arma la consola: une el catálogo, las partidas y el panel con la página.
 * No conoce ningún juego por nombre: todo sale del catálogo dinámico.
 */
import { $, crear, pedirJSON } from "./emisor.js";
import { CatalogoJuegos } from "./catalogo.js";
import { GestorPartidas } from "./partidas.js";
import { PanelEstadisticas } from "./panel.js";

const catalogo = new CatalogoJuegos();
const gestor = new GestorPartidas($("#partidas"));
const panel = new PanelEstadisticas(catalogo);

// ---------- navegación: Jugar / Estadísticas ----------
document.querySelectorAll(".pestana").forEach((b) => b.addEventListener("click", () => mostrarVista(b.dataset.vista)));
function mostrarVista(vista) {
  document.querySelectorAll(".pestana").forEach((b) => b.classList.toggle("activa", b.dataset.vista === vista));
  document.querySelectorAll(".vista").forEach((v) => v.classList.toggle("oculta", v.id !== "vista-" + vista));
  // las partidas siguen corriendo aunque se vea el panel; el panel solo consulta cuando está visible
  vista === "estadisticas" ? panel.iniciar() : panel.detener();
  history.replaceState(null, "", "#" + vista);
}

// ---------- catálogo ----------
catalogo.on("cambio", ({ juegos, problemas, nuevos }) => {
  $("#catalogo-info").textContent = `${juegos.length} juego(s) · se revisa la carpeta de juegos cada 4 s`;
  $("#catalogo").replaceChildren(...juegos.map((j) => tarjetaJuego(j, nuevos.includes(j.id))));
  if (!juegos.length) $("#catalogo").append(crear("p", { class: "vacio", text: "No hay juegos. Copia uno a la carpeta juegos/." }));
  $("#problemas").replaceChildren(...problemas.map((p) =>
    crear("li", { text: `La carpeta "${p.carpeta}" no cumple el contrato: ${p.errores.join("; ")}` })));
});
catalogo.on("error", (e) => { $("#catalogo-info").textContent = "No se pudo leer el catálogo: " + e.message; });

function tarjetaJuego(j, esNuevo) {
  const modos = j.modos.length ? j.modos : [null];
  const botones = modos.flatMap((modo) => {
    const texto = modo ? ` (${modo})` : "";
    return [crear("button", { text: "▶ Jugar aquí" + texto, onclick: () => gestor.abrir(j, modo) })];
  });
  return crear("article", { class: "juego" + (esNuevo ? " nuevo" : "") },
    crear("h3", { text: `${j.icono} ${j.nombre}` }),
    crear("p", { text: j.descripcion || "Sin descripción." }),
    crear("div", { class: "etiquetas" },
      crear("span", { text: "v" + j.version }),
      crear("span", { text: j.jugadores + " jugador(es)" }),
      crear("span", { text: j.origen === "externo" ? "externo (por URL)" : "carpeta local" }),
      ...j.modos.filter((m) => m.includes("computadora")).map(() => crear("span", { class: "ia", text: "🧠 IA en Prolog" })),
    ),
    crear("div", { class: "botones" }, ...botones,
      crear("button", { class: "secundario", text: "↗ Pestaña nueva", title: "Abrir otra instancia en una pestaña del navegador",
        onclick: () => gestor.abrirEnPestana(j, modos[0]) }),
      j.origen === "externo" ? crear("button", { class: "secundario", text: "Quitar", onclick: () => catalogo.quitar(j.id) }) : null,
    ),
  );
}

$("#form-externo").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const msj = $("#externo-msj");
  msj.className = "mensaje"; msj.textContent = "Revisando el manifiesto…";
  try {
    const j = await catalogo.agregarPorUrl($("#url-externo").value.trim());
    msj.className = "mensaje ok"; msj.textContent = `✔ "${j.nombre}" se agregó al catálogo.`;
    $("#url-externo").value = "";
  } catch (e) {
    msj.className = "mensaje error";
    msj.textContent = "✖ " + e.message + (e.datos?.detalles ? ": " + e.datos.detalles.join("; ") : "");
  }
});

// ---------- partidas ----------
gestor.on("cambio", (lista) => {
  $("#num-partidas").textContent = lista.length;
  if (!lista.length && !$("#partidas .vacio")) {
    $("#partidas").append(crear("p", { class: "vacio", text: "No hay partidas abiertas." }));
  }
});

// ---------- salud de los servicios ----------
async function revisarSalud() {
  try {
    const s = await pedirJSON("/api/salud");
    $("#salud").replaceChildren(
      ...[["ingest", "GameStats ingest"], ["analytics", "GameStats analytics"], ["prolog", "Prolog"]].map(([k, n]) =>
        crear("span", { class: s[k] ? "ok" : "", title: s.urls[k], text: n })),
    );
  } catch {
    $("#salud").textContent = "consola sin conexión";
  }
}

catalogo.iniciar();
revisarSalud();
setInterval(revisarSalud, 15000);
mostrarVista(location.hash === "#estadisticas" ? "estadisticas" : "jugar");
