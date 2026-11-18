/*
 * catalogo.js — CatalogoJuegos: el lado del navegador del REGISTRY.
 *
 * Le pregunta al servidor qué juegos hay cada pocos segundos. Si aparece un juego nuevo
 * (alguien copió su carpeta o lo agregó por URL), avisa con el evento "cambio" y la
 * consola lo dibuja. Nunca hay una lista de juegos escrita a mano.
 */
import { Emisor, pedirJSON } from "./emisor.js";

export class CatalogoJuegos extends Emisor {
  #juegos = new Map();       // id → manifiesto normalizado
  #firma = "";
  #timer = null;

  constructor(cadaMs = 4000) { super(); this.cadaMs = cadaMs; }

  get juegos() { return [...this.#juegos.values()]; }
  buscar(id) { return this.#juegos.get(id) || null; }

  iniciar() { this.actualizar(); this.#timer = setInterval(() => this.actualizar(), this.cadaMs); }
  detener() { clearInterval(this.#timer); }

  async actualizar() {
    try {
      const { juegos, problemas } = await pedirJSON("/api/juegos");
      const firma = JSON.stringify(juegos) + JSON.stringify(problemas);
      if (firma === this.#firma) return;               // nada cambió
      const anteriores = new Set(this.#juegos.keys());
      const primeraVez = this.#firma === "";
      this.#firma = firma;
      this.#juegos = new Map(juegos.map((j) => [j.id, j]));
      const nuevos = primeraVez ? [] : juegos.filter((j) => !anteriores.has(j.id)).map((j) => j.id);
      this.emitir("cambio", { juegos, problemas, nuevos });
    } catch (e) {
      this.emitir("error", e);
    }
  }

  async agregarPorUrl(manifestUrl) {
    const { juego } = await pedirJSON("/api/juegos", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ manifestUrl }),
    });
    await this.actualizar();
    return juego;
  }

  async quitar(id) {
    await pedirJSON("/api/juegos/" + encodeURIComponent(id), { method: "DELETE" });
    await this.actualizar();
  }
}
