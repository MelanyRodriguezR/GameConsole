# Guía de GameConsole — qué hay, cómo usarlo y qué falta

Revisado el 18 de noviembre de 2026. Entrega: **viernes 20 de noviembre, antes de las 10:00 pm** (Tec Digital) + video de 15 minutos como máximo.

---

## 1. ¿Qué es cada cosa? (mapa del proyecto)

```
proye2/
├── juegos/                 ← LOS 3 JUEGOS (cada uno es un proyecto aparte)
│   ├── combate/            🥊 dos luchadores; también contra la computadora (Prolog)
│   ├── atrapar/            ⭐ dos canastas atrapan estrellas
│   └── adivinanza/         🔢 adivinar el número secreto del otro
├── consola/                ← LA CONSOLA WEB (Node.js)
│   ├── server.js           el servidor: catálogo, eventos, panel y Prolog
│   ├── src/                registro de juegos, contrato del manifiesto, cliente de GameStats
│   ├── public/             la página: catálogo, partidas (iframes) y panel de estadísticas
│   └── test/               pruebas
├── prolog/                 ← LA IA (SWI-Prolog)
│   ├── combate.pl          las reglas con que decide la computadora
│   ├── servidor.pl         el servicio web que recibe el estado y responde la decisión
│   └── pruebas.pl          pruebas de las reglas
├── scripts/
│   ├── e2e.sh              prueba de TODO junto (la usa el CI)
│   └── partidas-demo.js    manda partidas de ejemplo de los 3 juegos (llena el panel)
├── docker-compose.yml      levanta todo: consola + Prolog + GameStats
├── render.yaml             deploy en Render
├── .github/workflows/ci.yml  CI/CD en GitHub Actions
├── docs/GUION-VIDEO.md     guion del video, minuto a minuto
└── README.md               documentación para entregar
```

**Cómo se conectan:**

```
 Juego (iframe o pestaña) ──eventos──► Consola ──► GameStats ingest (Go) ──► GameStats analytics (Scala)
                                          │                                          │
                                          ├──► Prolog (decisión de la computadora)   │
                                          └──◄── panel de estadísticas ◄─────────────┘
```

- Los **juegos** solo juegan y generan eventos con el formato de GameStats.
- La **consola** carga los juegos, reenvía los eventos y muestra el panel.
- **GameStats** (Proyecto 1) es el que **calcula** las estadísticas. La consola nunca las calcula.
- **Prolog** decide qué hace la computadora en el combate.

---

## 2. Cómo usarlo

### Opción A — Todo junto con Docker (la que se usa para la demo)

1. Abrir **Docker Desktop** y esperar a que diga *Engine running*.
   - Si sale *"Recursos insuficientes en el sistema"*: cerrar Discord, Chrome y otros programas pesados (o reiniciar la PC). La computadora tiene 7,4 GB de RAM y Docker necesita unos 2–3 GB libres.
2. En una terminal, dentro de la carpeta `proye2`:
   ```bash
   docker compose up --build
   ```
   La primera vez tarda varios minutos, porque compila GameStats. Las siguientes es casi inmediato.
3. Abrir **http://localhost:3000**
4. Para apagar todo:
   ```bash
   docker compose down
   ```
   Con `docker compose down -v` también se borran las estadísticas guardadas.

### Opción B — Un juego solo (sin consola)

Doble clic en `juegos/combate/index.html` (o en el de atrapar o adivinanza). En la columna derecha, "Enviar a" permite elegir:
- **GameStats local**: necesita la opción A corriendo.
- **GameStats en Render**: el publicado.
- **No enviar**: solo jugar.

El modo "contra la computadora" del combate necesita Prolog corriendo (opción A, o `swipl prolog/servidor.pl`).

### Opción C — Sin Docker (para programar)

```bash
swipl prolog/servidor.pl
```
```bash
cd consola && node server.js
```
Por defecto busca GameStats en `localhost:8080` y `localhost:9000`. Para usar el de Render:
```bash
cd consola && INGEST_URL=https://gamestats-ingest.onrender.com ANALYTICS_URL=https://gamestats-analytics-nz8a.onrender.com node server.js
```

---

## 3. Cómo usar la consola (http://localhost:3000)

| Quiero… | Hago… |
|---|---|
| Jugar un juego | **▶ Jugar** → en la tarjeta del juego, *Jugar aquí*. Se abre en un recuadro (iframe). |
| Jugar contra la computadora | En el Combate: *Jugar aquí (vs-computadora)*. La tarjeta "🧠 Lo que piensa la computadora" muestra la decisión de Prolog y su razón. |
| Jugar varias partidas a la vez | Presionar *Jugar aquí* varias veces (cada una es una instancia con su propio `matchId`) o *↗ Pestaña nueva*. |
| Ver las estadísticas | **📊 Estadísticas**: generales arriba, por juego abajo, partidas en curso. Se actualiza solo cada 3 s. |
| Agregar un juego nuevo **sin reiniciar** | Copiar una carpeta con `manifest.json` dentro de `juegos/` (aparece en ≤ 4 s), o pegar la URL de un `manifest.json` en *"Agregar un juego nuevo"*. |
| Llenar el panel rápido (antes del video) | `node scripts/partidas-demo.js http://localhost:3000/api/events` |

### Controles de los juegos

| Juego | Jugador 1 | Jugador 2 |
|---|---|---|
| 🥊 Combate | `A` `D` moverse · `W` saltar · `F` golpe · `G` patada · `S` bloquear | `←` `→` · `↑` · `K` golpe · `L` patada · `↓` bloquear |
| ⭐ Atrapa Estrellas | `A` `D` | `←` `→` |
| 🔢 Adivina el Número | escribir el número y Enter | escribir el número y Enter |

> Para que las teclas lleguen al juego, primero hay que hacer **clic dentro del recuadro** del juego.

---

## 4. ¿Cumple el enunciado? (revisión punto por punto)

| # | Requisito | Estado | Dónde se ve |
|---|---|---|---|
| 1 | Cargar y jugar 3 juegos distintos desde la consola | ✅ | catálogo de la consola |
| 2 | Varias instancias en paralelo (misma consola o pestañas) | ✅ | *Jugar aquí* varias veces, *Pestaña nueva* |
| 3 | Programación orientada a objetos | ✅ | clases `Luchador`, `Canasta`, `Objeto`→`Estrella`/`Dorada`/`Bomba`, `Jugador`, `Fase`… |
| 4 | Un juego contra la computadora con Prolog | ✅ | Combate vs-computadora + `prolog/combate.pl` |
| 5 | Eventos de inicio, desarrollo y fin | ✅ | `MATCH_STARTED`, `ATTACK`, `ITEM_CAUGHT`, `GUESS`, `AI_DECISION`, `MATCH_FINISHED`… |
| 6 | Eventos compatibles con GameStats, envíos concurrentes | ✅ | prueba integrada: 0 rechazados |
| 7 | Panel con estadísticas por juego y generales de GameStats | ✅ (con la rama nueva de GameStats) | ver la observación A |
| 8 | Cantidad de instancias por juego, actualizada en vivo | ✅ | "veces jugado" e "instancias en curso ahora" |
| 9 | Instalación, ejecución y deployment reproducibles | ⚠️ | Docker ✅ probado · falta subir a GitHub y desplegar en Render |
| — | Repositorio Git con historial | ⚠️ | hay commits locales; **falta subirlo a GitHub** |
| — | Docker (consola + Prolog + GameStats) | ✅ probado | `docker-compose.yml` |
| — | Pipeline CI/CD | ⚠️ | escrito; corre cuando el repo esté en GitHub |
| — | Documentación breve | ✅ | `README.md` |
| — | Video ≤ 15 min con link público | ❌ | `docs/GUION-VIDEO.md` |

**Observaciones del profesor:**

| Observación | Estado |
|---|---|
| Consola **dinámica** (juegos nuevos sin recompilar) | ✅ el servidor no tiene ninguna lista de juegos: lee la carpeta en cada consulta |
| Dos acciones: **jugar** (y en paralelo) y **ver estadísticas** | ✅ las dos pestañas de la consola |
| Estadísticas **generales**: veces jugado, **récords**, tiempo promedio | ✅ para **cualquier** juego, sin configurarlo (observación A) |
| Estadísticas **específicas** por juego | ✅ cada juego las **declara**; GameStats las calcula sin conocerlo (observación A) |
| Muchos patrones de diseño (6–8) | ✅ 10: Registry, Singleton, Factory, Template Method, Observer, Strategy, Adapter, Facade+Proxy, Mediator, State |
| JavaScript | ✅ |
| Juegos como proyectos aparte | ✅ cada carpeta de `juegos/` funciona sola |

### Observación A — récords y estadísticas, de forma DINÁMICA (✅ resuelto, falta publicarlo)

Antes, GameStats solo sabía analizar los juegos del Proyecto 1. Para cualquier otro devolvía `winner: null` y la tabla
de posiciones vacía. **No** se resolvió escribiendo un analizador por juego, porque eso obligaría a recompilar GameStats
cada vez que llega un juego nuevo. Se resolvió con **un solo analizador dinámico** que sirve para cualquier juego:

```
 juego ──MATCH_STARTED { metrics: [ qué medir ] }──► GameStats: DynamicAnalyzer ──► panel (solo muestra)
       ──eventos de la partida ─────────────────────►     (lee la declaración y la aplica)
       ──MATCH_FINISHED { winner, scores } ──────────►
```

1. **Generales (para todos los juegos, sin configurar nada):** con `winner` y `scores` de `MATCH_FINISHED`, GameStats
   calcula partidas, victorias, empates, derrotas, % de victorias, mejor puntaje y puntaje promedio, y los **récords
   generales**: puntaje más alto, más victorias, victoria más rápida y partida más larga.
2. **Específicas (las declara el juego):** cada juego tiene un método `estadisticas()` que devuelve una lista como
   `{ id: "aciertos", label: "Golpes acertados", action: "ATTACK", where: { hit: true }, op: "count" }`.
   `JuegoBase` la manda sola en `MATCH_STARTED`, y GameStats la calcula y también arma con ella la tabla de posiciones.
   Las que llevan `record: "max"` o `"min"` aparecen como **récords** del juego.

| Dónde | Qué cambió |
|---|---|
| GameStats `analytics/.../DynamicAnalyzer.scala` (nuevo) | El analizador genérico: entiende `count`, `sum`, `max`, `min`, `avg`, `last`, `pct` y `countBy`. |
| GameStats `GameAnalyzer.scala` | Los juegos del Proyecto 1 siguen con su analizador; **cualquier otro** usa el dinámico. |
| GameStats `store/Queries.scala` | Agrega `records` (récords) y `labels` (nombres que dio el juego) al resumen de cada juego. |
| GameStats `DynamicSuite.scala` (nuevo) | 4 pruebas con juegos **inventados** ("dardos", "ajedrez"). Todo GameStats pasa 21 de 21 pruebas. |
| `juegos/*/js/gamestats.js` | `JuegoBase` manda `metrics: this.estadisticas()` en `MATCH_STARTED`. |
| `juegos/*/js/<juego>.js` | Cada juego declara sus estadísticas en `estadisticas()`. El combate también manda `scores`. |
| `consola/public/js/panel.js` | Muestra los récords (por juego y de todos los juegos) con los nombres que manda GameStats. **No calcula nada.** |

**Prueba de que es dinámico:** `scripts/partidas-demo.js` también manda partidas de **"dardos"**, un juego que no
existe ni en la consola ni en GameStats, y GameStats igual le calcula ganador, tabla de posiciones, dianas y récords.

**Para probarlo hoy** (con la copia local de GameStats):
```bash
GAMESTATS_CONTEXT=../GameStats docker compose up --build
```
En PowerShell, primero `$env:GAMESTATS_CONTEXT="../GameStats"` y luego `docker compose up --build`.

**Para que quede publicado** (lo hace Mauro, o tú si eres colaboradora del repo):
```bash
cd C:\Users\melan\Downloads\GameStats
```
```bash
git push -u origin juegos-gameconsole
```
Luego, en GitHub, abrir un *Pull Request* de `juegos-gameconsole` hacia `main` y aceptarlo (*Merge*). Con eso:
- Render vuelve a desplegar GameStats solo, ya con el analizador dinámico.
- El `docker compose up --build` normal (sin `GAMESTATS_CONTEXT`) ya los incluye.

---

## 5. Lo que falta, en orden

| # | Tarea | Quién | Cómo |
|---|---|---|---|
| 1 | **Subir a GitHub** | tú | Crear un repo vacío en github.com (por ejemplo `GameConsole`, **público**), y luego: `git remote add origin https://github.com/<usuario>/GameConsole.git` y `git push -u origin main` |
| 2 | **Revisar el CI** | tú + Claude | En GitHub → pestaña *Actions*: los 4 trabajos deben quedar en verde. Si alguno falla, copiar el error y lo arreglamos. |
| 3 | **Publicar el analizador dinámico de GameStats** | Mauro (o tú) | Push de la rama `juegos-gameconsole` + Pull Request + Merge (observación A) |
| 4 | **Deploy en Render** | tú | render.com → *New* → *Blueprint* → elegir el repo. Crea `gameconsole` y `gameconsole-prolog`. Si Render les pone otro nombre, cambiar `PROLOG_URL` en `render.yaml`. |
| 5 | **Probar en Render** | tú | Abrir las 4 URLs del README (se duermen tras 15 min: esperar ~1 min la primera vez). |
| 6 | **Borrar `juegos-viejos/`** | tú | Ya no se usa y no está en git; se puede borrar a mano. |
| 7 | **Grabar el video** | ustedes | Seguir `docs/GUION-VIDEO.md`; subirlo a YouTube (no listado está bien) y poner el link en el README y en la entrega. |
| 8 | **Entregar** | ustedes | Tec Digital: link del repo + link del video, antes del viernes 10 pm. |

---

## 6. Problemas comunes

| Problema | Solución |
|---|---|
| Docker: *"Recursos insuficientes"* / WSL | Cerrar programas, reiniciar la PC y volver a abrir Docker Desktop. |
| *"port is already allocated"* | Algo usa el 3000, 8080, 8081 o 9000: cerrarlo, o `docker compose down` si es una corrida anterior. |
| El juego no responde a las teclas | Hacer clic dentro del recuadro del juego. |
| La computadora del combate no se mueve | Prolog no está corriendo: mirar la tarjeta "🧠" (dice si hay conexión). |
| El panel sale vacío | Las estadísticas aparecen cuando una partida **termina** (unos segundos después del `MATCH_FINISHED`). |
| En Render tarda o falla la primera vez | Los servicios gratis se duermen: esperar ~1 minuto y recargar. |

## 7. Pruebas

```bash
cd consola && npm test
```
```bash
cd prolog && swipl -g run_tests -t halt pruebas.pl
```
```bash
bash scripts/e2e.sh
```
La última prueba todo junto (necesita Docker). Resultado del 18/11: ✔ los 3 juegos, ✔ Prolog, ✔ 33 eventos válidos y 0 rechazados, ✔ panel con datos.
