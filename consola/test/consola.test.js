// Pruebas de la consola:  npm test   (usa el corredor de pruebas que trae Node)
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { validar } = require("../src/manifiesto");
const { RegistroJuegos } = require("../src/registro");

test("un manifiesto completo cumple el contrato", () => {
  const v = validar({ id: "combate", nombre: "Combate", version: "1.0", entrada: "index.html" });
  assert.strictEqual(v.ok, true);
});

test("un manifiesto incompleto o con id inválido no cumple", () => {
  assert.strictEqual(validar({ nombre: "x" }).ok, false);
  assert.strictEqual(validar({ id: "Con Espacios", nombre: "x", version: "1", entrada: "a.html" }).ok, false);
  assert.strictEqual(validar([]).ok, false);
});

test("el registro descubre juegos nuevos sin reiniciar (dinámico)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "juegos-"));
  const reg = new RegistroJuegos(dir, path.join(dir, "externos.json"));
  assert.deepStrictEqual(reg.listar(), []);

  fs.mkdirSync(path.join(dir, "nuevo"));
  fs.writeFileSync(path.join(dir, "nuevo", "manifest.json"),
    JSON.stringify({ id: "nuevo", nombre: "Nuevo", version: "1.0", entrada: "index.html" }));
  const juegos = reg.listar();
  assert.strictEqual(juegos.length, 1);
  assert.strictEqual(juegos[0].url, "/juegos/nuevo/index.html");

  fs.mkdirSync(path.join(dir, "roto"));
  fs.writeFileSync(path.join(dir, "roto", "manifest.json"), "{no es json");
  assert.strictEqual(reg.listar().length, 1);
  assert.strictEqual(reg.problemas[0].carpeta, "roto");

  fs.rmSync(dir, { recursive: true, force: true });
});
