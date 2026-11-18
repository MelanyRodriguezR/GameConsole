/*
 * manifiesto.js — El CONTRATO que debe cumplir cualquier juego para entrar a la consola.
 *
 * Un juego es válido si trae un manifest.json con al menos:
 *   { "id": "combate", "nombre": "Combate", "version": "1.0", "entrada": "index.html" }
 *
 * Opcionales: descripcion, jugadores, modos (ej. ["2-jugadores", "vs-computadora"]),
 * eventos (acciones propias que manda a GameStats), icono.
 *
 * La consola no conoce ningún juego por nombre: solo sabe leer este contrato.
 */
const OBLIGATORIOS = ["id", "nombre", "version", "entrada"];
const ID_VALIDO = /^[a-z0-9][a-z0-9_-]{0,39}$/;

function validar(m) {
  const errores = [];
  if (!m || typeof m !== "object" || Array.isArray(m)) return { ok: false, errores: ["el manifiesto no es un objeto JSON"] };
  for (const campo of OBLIGATORIOS) {
    if (typeof m[campo] !== "string" || !m[campo].trim()) errores.push(`falta el campo "${campo}" (texto)`);
  }
  if (typeof m.id === "string" && !ID_VALIDO.test(m.id)) {
    errores.push('"id" solo puede tener minúsculas, números, - y _ (será el gameId en GameStats)');
  }
  if (m.modos !== undefined && !Array.isArray(m.modos)) errores.push('"modos" debe ser una lista');
  if (m.eventos !== undefined && !Array.isArray(m.eventos)) errores.push('"eventos" debe ser una lista');
  return { ok: errores.length === 0, errores };
}

// Deja solo los campos conocidos, con valores por defecto.
function normalizar(m, origen, urlBase) {
  return {
    id: m.id,
    nombre: m.nombre,
    version: m.version,
    descripcion: m.descripcion || "",
    icono: m.icono || "🎮",
    jugadores: m.jugadores || 1,
    modos: m.modos || [],
    eventos: m.eventos || [],
    origen,                                   // "local" | "externo"
    url: new URL(m.entrada, urlBase).href.replace(/^local:\/\/consola/, ""),
  };
}

module.exports = { validar, normalizar };
