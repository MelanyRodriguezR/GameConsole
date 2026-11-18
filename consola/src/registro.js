/*
 * registro.js — Patrón REGISTRY (catálogo de plugins) + SINGLETON.
 *
 * Aquí está lo DINÁMICO de la consola: la lista de juegos NO está escrita en el código.
 * Cada vez que alguien pide la lista, el registro:
 *   1. revisa la carpeta de juegos (cada subcarpeta con manifest.json es un juego), y
 *   2. agrega los juegos externos que se registraron por URL mientras la consola corría.
 *
 * Por eso, para agregar un juego nuevo basta con copiar su carpeta o pegar la URL de su
 * manifest.json: la consola lo muestra sin reiniciar ni recompilar nada.
 */
const fs = require("fs");
const path = require("path");
const { validar, normalizar } = require("./manifiesto");

class RegistroJuegos {
  constructor(juegosDir, archivoExternos) {
    this.juegosDir = juegosDir;
    this.archivoExternos = archivoExternos;
    this.externos = this._leerExternos();   // [{ manifestUrl, manifiesto }]
    this.problemas = [];                    // juegos que no cumplen el contrato
  }

  // ---- Lista completa (se arma de nuevo en cada llamada) ----
  listar() {
    this.problemas = [];
    const locales = this._escanearCarpeta();
    const ids = new Set(locales.map((j) => j.id));
    const externos = [];
    for (const e of this.externos) {
      if (ids.has(e.manifiesto.id)) continue;        // un local con el mismo id tiene prioridad
      ids.add(e.manifiesto.id);
      externos.push(normalizar(e.manifiesto, "externo", e.manifestUrl));
    }
    return locales.concat(externos);
  }

  buscar(id) { return this.listar().find((j) => j.id === id) || null; }

  // ---- Registrar un juego externo por la URL de su manifest.json ----
  async registrarExterno(manifestUrl) {
    let url;
    try { url = new URL(manifestUrl); } catch { throw new ErrorContrato(["la URL no es válida"]); }
    if (!/^https?:$/.test(url.protocol)) throw new ErrorContrato(["la URL debe empezar con http:// o https://"]);

    let manifiesto;
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error("HTTP " + r.status);
      manifiesto = await r.json();
    } catch (e) {
      throw new ErrorContrato([`no se pudo leer el manifiesto (${e.message})`]);
    }
    const v = validar(manifiesto);
    if (!v.ok) throw new ErrorContrato(v.errores);

    this.externos = this.externos.filter((e) => e.manifiesto.id !== manifiesto.id);
    this.externos.push({ manifestUrl: url.href, manifiesto });
    this._guardarExternos();
    return normalizar(manifiesto, "externo", url.href);
  }

  quitarExterno(id) {
    const antes = this.externos.length;
    this.externos = this.externos.filter((e) => e.manifiesto.id !== id);
    this._guardarExternos();
    return this.externos.length < antes;
  }

  // ---- privados ----
  _escanearCarpeta() {
    let carpetas = [];
    try {
      carpetas = fs.readdirSync(this.juegosDir, { withFileTypes: true }).filter((d) => d.isDirectory());
    } catch {
      return [];
    }
    const juegos = [];
    for (const d of carpetas) {
      const archivo = path.join(this.juegosDir, d.name, "manifest.json");
      if (!fs.existsSync(archivo)) continue;
      let m;
      try { m = JSON.parse(fs.readFileSync(archivo, "utf8")); } catch (e) {
        this.problemas.push({ carpeta: d.name, errores: ["manifest.json no es JSON válido"] });
        continue;
      }
      const v = validar(m);
      if (!v.ok) { this.problemas.push({ carpeta: d.name, errores: v.errores }); continue; }
      juegos.push(normalizar(m, "local", `local://consola/juegos/${encodeURIComponent(d.name)}/`));
    }
    return juegos.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  _leerExternos() {
    try { return JSON.parse(fs.readFileSync(this.archivoExternos, "utf8")); } catch { return []; }
  }

  _guardarExternos() {
    try {
      fs.mkdirSync(path.dirname(this.archivoExternos), { recursive: true });
      fs.writeFileSync(this.archivoExternos, JSON.stringify(this.externos, null, 2));
    } catch (e) {
      console.warn("no se pudieron guardar los juegos externos:", e.message);
    }
  }
}

class ErrorContrato extends Error {
  constructor(errores) { super(errores.join("; ")); this.errores = errores; }
}

// SINGLETON: toda la consola comparte un único registro.
let instancia = null;
RegistroJuegos.obtener = function (juegosDir, archivoExternos) {
  if (!instancia) instancia = new RegistroJuegos(juegosDir, archivoExternos);
  return instancia;
};

module.exports = { RegistroJuegos, ErrorContrato };
