# GameConsole — Proyecto 2 (Lenguajes de Programación, TEC)

Consola web de videojuegos en JavaScript (POO) que **carga los juegos de forma dinámica**,
deja jugar varias partidas en paralelo, usa **Prolog** para la IA de la computadora y manda
todos los eventos a **GameStats** (el Proyecto 1). GameStats calcula las estadísticas y la
consola solo las muestra.

```
                         ┌──────────────── navegador ────────────────┐
                         │  Consola (public/)                         │
                         │   ├─ partida 1 (iframe) ─┐                 │
                         │   ├─ partida 2 (iframe) ─┤ postMessage     │
                         │   └─ panel de estadísticas                 │
                         └──────────┬─────────────────────────────────┘
                 /api/juegos        │ /api/events   /api/panel   /api/prolog
                         ┌──────────▼──────────┐
 carpeta juegos/ ──────► │ servidor consola     │──POST /events──► GameStats ingest (Go)
 (cada juego con su      │ (Node.js, :3000)     │──GET /results──► GameStats analytics (Scala)
  manifest.json)         └──────────┬───────────┘
                                    └──POST /combate/decision──► IA SWI-Prolog (:8081)
```

## Estado actual

| Parte | Estado |
|---|---|
| Consola con catálogo **dinámico** (carpeta + URL de manifiesto, sin reiniciar) | ✅ |
| Varias partidas a la vez (en la consola y en pestañas nuevas), cada una con su `matchId` | ✅ probado |
| Combate contra la computadora con **IA en SWI-Prolog** | ✅ probado |
| Eventos a GameStats a través de la consola (cola, lotes, reintentos) | ✅ probado: 88 válidos, 0 rechazados |
| Panel de estadísticas que consulta a GameStats cada 3 s | ✅ probado |
| 3 juegos como proyectos independientes (combate, atrapar, adivinanza) | ✅ probados dentro de la consola, en paralelo |
| Docker (`consola/Dockerfile`, `prolog/Dockerfile`, `docker-compose.yml`) | ✅ escrito · las imágenes corren pruebas al construirse |
| CI/CD (GitHub Actions) + prueba integrada `scripts/e2e.sh` | ✅ en verde en GitHub |
| Deploy en Render (`render.yaml`) | ✅ escrito · falta crear el Blueprint en Render |

## Estructura

```
consola/          servidor Node.js (sin dependencias) + la página de la consola
  server.js       rutas: /api/juegos, /api/events, /api/panel, /api/prolog, /api/salud
  src/            registro.js (catálogo), manifiesto.js (contrato), gamestats.js (cliente)
  public/         index.html, css/, js/ (app, catalogo, partidas, panel, emisor)
  test/           pruebas (npm test)
juegos/           UN JUEGO POR CARPETA; la consola los descubre sola
  combate/        cada juego es independiente: se puede abrir solo, con doble clic
  atrapar/
  adivinanza/
prolog/
  combate.pl      reglas de decisión de la computadora
  servidor.pl     servicio HTTP de SWI-Prolog
  pruebas.pl      pruebas de las reglas (plunit)
scripts/
  e2e.sh          prueba integrada (docker compose + partidas + panel)
  partidas-demo.js  manda partidas de los 3 juegos en paralelo (sirve para llenar el panel)
docker-compose.yml  consola + Prolog + GameStats (ingest y analytics)
render.yaml         deploy en Render
.github/workflows/ci.yml  CI/CD
```

## Ejecutar con Docker (recomendado)

```bash
docker compose up --build
```

Abrir http://localhost:3000. Levanta la consola, Prolog y GameStats (ingest + analytics, que se construyen desde el
repositorio público del Proyecto 1; la primera vez tarda varios minutos). La carpeta `juegos/` está montada: si copias ahí un juego nuevo, aparece en la consola sin reiniciar.

Prueba integrada (la misma que corre el CI):

```bash
bash scripts/e2e.sh
```

> Si Docker Desktop dice *"Recursos insuficientes en el sistema"* (WSL), cerrar programas pesados o reiniciar la PC.

## Ejecutar sin Docker (desarrollo)

Se necesita Node.js 20+ y SWI-Prolog.

1. IA de Prolog:
   ```bash
   swipl prolog/servidor.pl
   ```
2. Consola, usando el GameStats publicado en Render:
   ```bash
   cd consola && INGEST_URL=https://gameconsole-ingest.onrender.com ANALYTICS_URL=https://gameconsole-analytics-zdfb.onrender.com node server.js
   ```
   Para usar un GameStats local (`docker compose up analytics ingest` en el Proyecto 1), basta con `node server.js`,
   que por defecto usa `localhost:8080` y `localhost:9000`.
3. Abrir http://localhost:3000

Variables: `PORT` (3000), `JUEGOS_DIR` (../juegos), `INGEST_URL`, `ANALYTICS_URL`, `PROLOG_URL` (http://localhost:8081).

## El contrato de un juego (cómo agregar uno nuevo)

1. Una carpeta con un `manifest.json`:
   ```json
   { "id": "combate", "nombre": "Combate", "version": "1.1", "entrada": "index.html",
     "icono": "🥊", "jugadores": 2, "modos": ["2-jugadores", "vs-computadora"] }
   ```
   `id` será el `gameId` en GameStats (minúsculas, números, `-` y `_`).
2. La consola abre la `entrada` con estos parámetros en la URL:
   `?gamestats=<url de eventos>&prolog=<url de la IA>&instancia=<id>&modo=<modo>&consola=1`
3. El juego manda sus eventos (formato GameStats) a la URL de `gamestats`, y puede avisarle a la consola con
   `window.parent.postMessage({ fuente: "gameconsole-juego", instancia, tipo: "evento", evento }, "*")`.
4. **Estadísticas.** No hay que tocar GameStats:
   - **Generales**, para cualquier juego: basta con mandar `MATCH_FINISHED.data.winner` (o `PLAYER_WON`) y, si el juego
     tiene puntaje, `MATCH_FINISHED.data.scores` (`{ "jugador": puntos }`). Con eso GameStats calcula partidas,
     victorias, empates, % de victorias, mejor puntaje, tiempo promedio y los **récords generales** (puntaje más alto,
     más victorias, victoria más rápida, partida más larga).
   - **Específicas**: el juego las **declara** en `MATCH_STARTED.data.metrics` y GameStats las calcula con su analizador
     **dinámico** (un solo analizador para todos los juegos):
     ```json
     { "id": "aciertos",  "label": "Golpes acertados", "action": "ATTACK", "where": { "hit": true }, "op": "count" },
     { "id": "dano",      "label": "Daño causado",     "action": "ATTACK", "field": "damage", "op": "sum", "record": "max" },
     { "id": "recibido",  "label": "Daño recibido",    "action": "ATTACK", "field": "damage", "player": "targetId", "op": "sum" },
     { "id": "precision", "label": "% acierto",        "op": "pct", "of": "aciertos", "over": "ataques" },
     { "id": "decisiones","label": "Decisiones de la IA", "action": "AI_DECISION", "field": "decision", "op": "countBy", "scope": "match" }
     ```
     `op`: `count` · `sum` · `max` · `min` · `avg` · `last` · `pct` · `countBy`. `record: "max" | "min"` la convierte en récord del juego.
     En los juegos se declaran en el método `estadisticas()` de cada clase (Template Method: `JuegoBase` lo manda solo).

Se agrega **sin reiniciar nada**: copiando la carpeta a `juegos/` (aparece en ≤ 4 s) o pegando la URL de su
`manifest.json` en la consola, en "Agregar un juego nuevo". Si el manifiesto no cumple el contrato, la consola dice qué falta.

## Juegos

| Juego | Cómo se juega | Eventos propios |
|---|---|---|
| 🥊 Combate | Gana quien gane 2 rondas. J1: `A D W` + `F` golpe, `G` patada, `S` bloquear. J2: flechas + `K` `L` `↓`. Modo **contra la computadora**. | `ATTACK`, `ROUND_END`, `AI_DECISION` |
| ⭐ Atrapa Estrellas | 60 s; cada jugador mueve su canasta (J1 `A D`, J2 `← →`). ⭐ +1, 🌟 +3, 💣 −2 y aturde. Gana quien tenga más puntos. | `ITEM_CAUGHT` |
| 🔢 Adivina el Número | Cada uno elige un número secreto (1–100) y se turnan para adivinar el del otro con pistas mayor/menor. Si el J1 acierta, el J2 tiene un último turno para empatar. | `SECRET_CHOSEN`, `GUESS` |

Cada juego trae su propia copia de `js/gamestats.js` (la base común): así cada uno es un proyecto
independiente que funciona solo o dentro de la consola.

Todos mandan además `MATCH_STARTED`, `PLAYER_JOINED`, `PLAYER_WON`, `PLAYER_LOST` y `MATCH_FINISHED`.

## IA en Prolog (combate)

Unas 10 veces por segundo, `ControlIA` (JavaScript) le manda a Prolog una "foto" de la pelea: distancia, vidas,
si el rival ataca o bloquea, si estoy contra la pared, el tiempo que queda. `combate.pl` responde **una acción y su razón**
usando reglas en orden de prioridad:

1. Si un ataque lo deja KO → ese ataque.
2. Si el rival ataca de cerca → bloquear.
3. Si voy perdiendo con poca vida → alejarse (o saltar si estoy acorralado).
4. Si el rival bloquea → esperar a que baje la guardia.
5. Si tengo al rival al alcance → el mejor ataque, elegido con una búsqueda que compara el **valor** de cada opción
   (daño real considerando el bloqueo, bono si noquea, castigo por el tiempo de recarga).
6. a 9. Recargando y muy cerca → alejarse; ganando con poco tiempo → alejarse; lejos → acercarse; si no, esperar.

La página del combate muestra en vivo qué decidió Prolog y por qué. Cada cambio de decisión se manda a GameStats
como evento `AI_DECISION`.

## Decisiones técnicas

- **Consola dinámica.** El servidor no tiene ninguna lista de juegos: cada vez que se le pide, revisa la carpeta
  `juegos/` y los juegos externos registrados. El navegador vuelve a pedir la lista cada 4 s.
- **Partidas en paralelo sin mezclarse.** Cada partida corre en su propio `iframe` (o en otra pestaña) y genera un
  `matchId` único (`gameId-UUID`). GameStats separa los eventos por ese `matchId`.
- **Envío sin bloquear.** Cada juego pone sus eventos en una cola y los manda en lotes de hasta 50 con `fetch`, que es
  asíncrono. Si GameStats falla, el lote vuelve a la cola y se reintenta con espera creciente (2 s, 4 s… hasta 30 s).
- **CORS.** GameStats no tiene CORS. En lugar de cambiarlo, los juegos mandan los eventos a la consola
  (`/api/events`) y la consola los reenvía a ingest. El panel lee los resultados a través de `/api/panel`.
- **El panel no calcula.** Muestra lo que devuelven `analytics /results/...` e `ingest /matches` y `/stats`.
  "Veces jugado", "tiempo promedio", tabla de posiciones y **récords** vienen de `/results/games/<id>`. Las partidas en
  curso vienen de ingest. Hasta los nombres de las columnas los manda GameStats (`labels`).
- **Estadísticas dinámicas (sin recompilar GameStats).** GameStats no conoce nuestros juegos por nombre: un solo
  analizador genérico interpreta las estadísticas que cada juego declara al empezar la partida. La prueba integrada
  lo demuestra con "dardos", un juego que no existe en ningún lado y que igual recibe ganador, tabla y récords.
  Cambio en GameStats: copia `github.com/MelanyRodriguezR/GameStats`, rama `juegos-gameconsole` (`DynamicAnalyzer.scala`); el repositorio original no se toca.
- **La IA nunca frena el juego.** Las preguntas a Prolog son asíncronas: mientras llega la respuesta, el luchador
  sigue con la última decisión.

## Patrones de diseño

| Patrón | Dónde | Qué resuelve |
|---|---|---|
| **Registry / Plugin** | `consola/src/registro.js`, `public/js/catalogo.js` | Juegos nuevos sin recompilar ni reiniciar |
| **Singleton** | `RegistroJuegos.obtener()` | Un único catálogo compartido por todo el servidor |
| **Factory** | `FabricaPartidas` (consola), `FabricaObjetos` (atrapar) | Crear una instancia de cualquier juego sin saber cuál es |
| **Template Method** | `JuegoBase.iniciar()` / `terminar()` | Todas las partidas tienen el mismo ciclo y los mismos eventos de inicio y fin |
| **Observer** | `Emisor` (consola y juegos) | Bitácora, consola y panel se enteran de lo que pasa sin acoplarse |
| **Strategy** | `Control` → `ControlTeclado` / `ControlIA` | El luchador no sabe si lo maneja una persona o Prolog |
| **Adapter** | `ControlIA._estado/_traducir`, `prolog/servidor.pl` | Traduce el estado del juego a hechos de Prolog y la respuesta a una orden |
| **Facade + Proxy** | `consola/src/gamestats.js` | Una sola llamada para el panel; resuelve CORS sin tocar GameStats |
| **Mediator** | `GestorPartidas` | Los juegos no conocen a la consola ni entre ellos; los mensajes pasan por el gestor |
| **State** | Fases de Adivinanza | Cada fase decide qué hacer con lo que escribe el jugador |

Además: **herencia y polimorfismo** (`Objeto` → `Estrella`, `Dorada`, `Bomba`) y **encapsulación** con campos
privados (`#vida` del luchador, `#puntos` de la canasta, `#secreto` del jugador de Adivinanza).

## Pruebas

```bash
cd consola && npm test                                  # consola
cd prolog && swipl -g run_tests -t halt pruebas.pl      # reglas de la IA
bash scripts/e2e.sh                                     # todo integrado (Docker)
```

## CI/CD

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) corre en cada push:

| Job | Qué hace |
|---|---|
| Pruebas | pruebas de la consola, revisión de los juegos (sintaxis y manifiestos) y pruebas de Prolog |
| Imágenes | construye las imágenes Docker de la consola y de Prolog (que vuelven a correr sus pruebas) |
| Prueba integrada | `scripts/e2e.sh`: `docker compose up` con GameStats, juega partidas de los 3 juegos en paralelo y revisa el panel |

**Deploy continuo:** Render está conectado al repositorio y redepliega en cada push a `main`.

## Deployment (Render)

Igual que GameStats: [`render.yaml`](render.yaml) es un Blueprint que crea **4 servicios Docker gratis**. Dos salen de
este repositorio y dos de la copia de GameStats con el analizador dinámico (`MelanyRodriguezR/GameStats`, rama
`juegos-gameconsole`):

| Servicio | URL |
|---|---|
| Consola | https://gameconsole-w8oh.onrender.com |
| IA Prolog | https://gameconsole-prolog-x51m.onrender.com |
| GameStats ingest | https://gameconsole-ingest.onrender.com |
| GameStats analytics | https://gameconsole-analytics-zdfb.onrender.com |

Crear desde cero: Render → **New → Blueprint** → elegir este repositorio. Si Render le pone otra URL a algún
servicio (agrega un sufijo cuando el nombre ya existe), actualizar las URLs en `render.yaml`. En el plan gratis los
servicios se duermen tras 15 min: **antes de la demo, abrir las 4 URLs** y esperar ~1 min.

## Equipo

- Mauro Zamora
- Melany Rodríguez
