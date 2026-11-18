// Patrón OBSERVER: quien quiera enterarse de algo se suscribe con on().
export class Emisor {
  #oyentes = new Map();
  on(nombre, fn) {
    if (!this.#oyentes.has(nombre)) this.#oyentes.set(nombre, []);
    this.#oyentes.get(nombre).push(fn);
    return () => this.off(nombre, fn);
  }
  off(nombre, fn) {
    const lista = this.#oyentes.get(nombre) || [];
    this.#oyentes.set(nombre, lista.filter((f) => f !== fn));
  }
  emitir(nombre, dato) {
    for (const fn of this.#oyentes.get(nombre) || []) {
      try { fn(dato); } catch (e) { console.error(`oyente de "${nombre}" falló`, e); }
    }
  }
}

// Utilidades pequeñas que usan varios módulos
export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export function crear(etiqueta, props = {}, ...hijos) {
  const el = document.createElement(etiqueta);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  }
  for (const h of hijos.flat()) if (h != null) el.append(h instanceof Node ? h : String(h));
  return el;
}
export async function pedirJSON(url, opciones) {
  const r = await fetch(url, opciones);
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(datos.error || "HTTP " + r.status), { datos });
  return datos;
}
