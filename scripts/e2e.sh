#!/usr/bin/env bash
# Prueba integrada de GameConsole: levanta todo con docker compose y revisa que
#   1. la consola descubra los 3 juegos,
#   2. Prolog responda una decisión a través de la consola,
#   3. partidas de los 3 juegos (enviadas a la vez) lleguen a GameStats sin rechazos,
#   4. el panel de la consola muestre las estadísticas que calcula GameStats.
#
# Uso:  bash scripts/e2e.sh        (requiere Docker y Node.js)
set -euo pipefail
cd "$(dirname "$0")/.."

CONSOLA=${CONSOLA:-http://localhost:3000}
INGEST=${INGEST:-http://localhost:8080}

echo "▶ Levantando consola + Prolog + GameStats…"
docker compose up -d --build --wait

esperar() {   # esperar <url> <segundos>
  for _ in $(seq "$2"); do curl -fs "$1" >/dev/null && return 0; sleep 1; done
  echo "✖ $1 no respondió" >&2; return 1
}
esperar "$CONSOLA/api/juegos" 90

echo "▶ 1. Catálogo dinámico"
JUEGOS=$(curl -fs "$CONSOLA/api/juegos" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).juegos.map(j=>j.id).sort().join(",")))')
echo "   juegos: $JUEGOS"
[ "$JUEGOS" = "adivinanza,atrapar,combate" ] || { echo "✖ se esperaban los 3 juegos"; exit 1; }

echo "▶ 2. Decisión de Prolog"
DECISION=$(curl -fs -X POST "$CONSOLA/api/prolog/combate/decision" -H 'Content-Type: application/json' \
  -d '{"distancia":60,"miVida":50,"rivalVida":8,"miEspera":0,"rivalAtacando":"ninguno","rivalBloqueando":false,"rivalEnAire":false,"enEsquina":false,"tiempo":30}')
echo "   $DECISION"
echo "$DECISION" | grep -q '"accion"' || { echo "✖ Prolog no respondió una acción"; exit 1; }

echo "▶ 3. Partidas de los 3 juegos en paralelo"
node scripts/partidas-demo.js "$CONSOLA/api/events"

echo "▶ 4. GameStats procesa las partidas (esperando a analytics)…"
for _ in $(seq 60); do
  LISTO=$(curl -fs "$CONSOLA/api/panel" | node -e '
    let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
      const p=JSON.parse(s).porJuego||{};
      const n=id=>(p[id]&&p[id].matches)||0;
      console.log(["combate","atrapar","adivinanza"].every(id=>n(id)>=1) ? "si" : "no");
    })' || echo no)
  [ "$LISTO" = "si" ] && break
  sleep 2
done
[ "$LISTO" = "si" ] || { echo "✖ el panel no muestra partidas de los 3 juegos"; curl -s "$CONSOLA/api/panel"; exit 1; }

STATS=$(curl -fs "$INGEST/stats")
echo "   ingest: $STATS"
echo "$STATS" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const x=JSON.parse(s); if(x.rejected!==0||x.valid<1){console.error("✖ hubo eventos rechazados");process.exit(1)}})'

echo "✔ Prueba integrada correcta"
