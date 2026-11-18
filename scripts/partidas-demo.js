/*
 * partidas-demo.js — Manda a la consola partidas completas de los 3 juegos, A LA VEZ,
 * con el mismo formato que generan los juegos de verdad. Lo usa la prueba integrada
 * (scripts/e2e.sh) y sirve para llenar el panel antes de una demo.
 *
 *   node scripts/partidas-demo.js [url-de-eventos]   (por defecto http://localhost:3000/api/events)
 */
const crypto = require("crypto");
const URL_EVENTOS = process.argv[2] || "http://localhost:3000/api/events";

function partida(gameId, jugadores, jugadas, ganador) {
  const matchId = `${gameId}-${crypto.randomUUID()}`;
  let t = Date.now() - 60000;
  const ev = (type, action, playerId, data) => {
    t += 500;
    const e = { eventId: crypto.randomUUID(), timestamp: new Date(t).toISOString(), gameId, gameVersion: "1.0", matchId, type, action };
    if (playerId) e.playerId = playerId;
    if (data) e.data = data;
    return e;
  };
  const eventos = [ev("SYSTEM", "MATCH_STARTED", null, { players: jugadores, mode: "2-jugadores" })];
  jugadores.forEach((j) => eventos.push(ev("SYSTEM", "PLAYER_JOINED", j, { name: j })));
  jugadas.forEach(([j, accion, datos]) => eventos.push(ev("GAMEPLAY", accion, j, datos)));
  jugadores.forEach((j) => eventos.push(ev("GAMEPLAY", j === ganador ? "PLAYER_WON" : "PLAYER_LOST", j, { result: j === ganador ? "win" : "loss" })));
  eventos.push(ev("SYSTEM", "MATCH_FINISHED", null, { winner: ganador, durationMs: t - (Date.now() - 60000) }));
  return { matchId, eventos };
}

const combate = partida("combate", ["ana", "computadora"], [
  ["ana", "ATTACK", { targetId: "computadora", attack: "golpe", hit: true, blocked: false, damage: 8, targetHp: 92, round: 1 }],
  ["computadora", "AI_DECISION", { accion: "bloquear", razon: "el rival esta atacando de cerca: me cubro" }],
  ["computadora", "ATTACK", { targetId: "ana", attack: "patada", hit: true, blocked: false, damage: 14, targetHp: 86, round: 1 }],
  ["computadora", "ROUND_END", { round: 1, winnerId: "computadora", reason: "ko", hp: { ana: 0, computadora: 40 } }],
  ["computadora", "ROUND_END", { round: 2, winnerId: "computadora", reason: "ko", hp: { ana: 0, computadora: 22 } }],
], "computadora");

const atrapar = partida("atrapar", ["luis", "sofia"], [
  ["luis", "ITEM_CAUGHT", { item: "estrella", points: 1, score: 1, stunned: false }],
  ["sofia", "ITEM_CAUGHT", { item: "dorada", points: 3, score: 3, stunned: false }],
  ["luis", "ITEM_CAUGHT", { item: "bomba", points: -2, score: 0, stunned: true }],
  ["sofia", "ITEM_CAUGHT", { item: "estrella", points: 1, score: 4, stunned: false }],
], "sofia");

const adivinanza = partida("adivinanza", ["ana", "luis"], [
  ["ana", "SECRET_CHOSEN", { range: "1-100" }],
  ["luis", "SECRET_CHOSEN", { range: "1-100" }],
  ["ana", "GUESS", { targetId: "luis", guess: 50, result: "higher", attempt: 1 }],
  ["luis", "GUESS", { targetId: "ana", guess: 50, result: "lower", attempt: 1 }],
  ["ana", "GUESS", { targetId: "luis", guess: 70, result: "correct", attempt: 2 }],
  ["luis", "GUESS", { targetId: "ana", guess: 25, result: "lower", attempt: 2 }],
], "ana");

async function enviar({ matchId, eventos }) {
  // En dos lotes, como hace la cola de los juegos
  for (const lote of [eventos.slice(0, 4), eventos.slice(4)]) {
    const r = await fetch(URL_EVENTOS, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lote) });
    if (!r.ok) throw new Error(`${matchId}: la consola respondió ${r.status} ${await r.text()}`);
  }
  console.log(`   ✔ ${matchId} (${eventos.length} eventos)`);
}

// Las tres partidas se envían EN PARALELO
Promise.all([combate, atrapar, adivinanza].map(enviar)).catch((e) => { console.error("✖", e.message); process.exit(1); });
