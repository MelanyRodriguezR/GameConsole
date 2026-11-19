# Cómo funciona y cómo probar TODO — paso a paso

> Guía para revisar que el proyecto cumple, antes de grabar el video.
> Si algo no sale como dice aquí, anota en qué paso fue y qué apareció en pantalla.

---

## 1. ¿Cómo funciona? (en palabras simples)

Imagina un **arcade**:

| Pieza | Es como… | Qué hace |
|---|---|---|
| **Consola** (`consola/`) | el mueble del arcade | Muestra los juegos disponibles, los abre (uno o varios a la vez) y tiene la pantalla de **📊 Estadísticas**. |
| **Juegos** (`juegos/`) | los cartuchos | Cada carpeta es un juego aparte. La consola **descubre sola** las carpetas: no tiene una lista fija. |
| **Prolog** (`prolog/`) | el "cerebro" de la máquina | Cuando juegas **contra la computadora** en el Combate, decide qué hace la computadora (atacar, bloquear, huir…). |
| **GameStats** (el Proyecto 1) | el contador de puntajes | Recibe todo lo que pasa en los juegos (los "eventos") y **calcula** las estadísticas: veces jugado, ganadores, récords, tiempo promedio. |

```
  Tú juegas ──► el juego manda "eventos" ──► GameStats los guarda y calcula ──► la consola los MUESTRA
                 (ej: "Ana golpeó a Luis")      (ganador, récords, promedios)        (no calcula nada)
```

**Lo "dinámico" que pidió el profesor:**
- **Consola dinámica:** si pones una carpeta de juego nueva en `juegos/`, aparece sola en la consola, sin reprogramar ni reiniciar nada.
- **Estadísticas dinámicas:** cada juego **dice qué quiere medir** (por ejemplo, "cuenta los golpes que acertaron") y GameStats lo calcula sin conocer el juego. Las **generales** (ganador, victorias, récords, tiempo) salen solas para cualquier juego.

---

## 2. Las dos formas de usarlo

| Forma | Cuándo | Cómo |
|---|---|---|
| **A. En internet (Render)** | Para el video y para que el profesor lo vea | Abrir **https://gameconsole-w8oh.onrender.com** |
| **B. En tu computadora (Docker)** | Para probar sin depender de internet, y para mostrar que se agrega un juego nuevo copiando una carpeta | `docker compose up --build` y abrir **http://localhost:3000** |

---

## 3. Prueba completa EN INTERNET (Render) — unos 10 minutos

### Paso 0 — Despertar los servicios (¡siempre antes de probar o grabar!)
En el plan gratis, Render apaga los servicios si nadie los usa por 15 minutos. Abre estas **4 pestañas** y espera
a que cada una muestre algo (puede tardar hasta 1 minuto):

1. https://gameconsole-w8oh.onrender.com
2. https://gameconsole-prolog-x51m.onrender.com/health
3. https://gameconsole-analytics-zdfb.onrender.com/health
4. https://gameconsole-ingest.onrender.com/health

✅ **Debe pasar:** la 1 muestra la consola; las otras muestran un texto corto, como `ok` o `{"ok":true…}`.
Arriba a la derecha de la consola hay 3 puntitos: **GameStats ingest, GameStats analytics, Prolog**. Deben verse
**verdes**. Si alguno está rojo, espera 30 segundos y recarga.

> ⚠️ **Importante:** cuando Render apaga los servicios, **se borran las estadísticas guardadas**. Es normal en el
> plan gratis. Por eso, para el video: despierta todo, **juega** y después muestra el panel, **sin dejar pasar
> 15 minutos** sin usarlo.

### Paso 1 — La consola encuentra los juegos sola
En **▶ Jugar** deben aparecer **3 tarjetas**: 🔢 Adivina el Número, ⭐ Atrapa Estrellas y 🥊 Combate.
✅ Cumple: *"cargar y jugar tres videojuegos desde una consola web"*.

### Paso 2 — Jugar el Combate (2 jugadores)
1. En la tarjeta 🥊 Combate pulsa **▶ Jugar aquí (2-jugadores)**. Se abre un recuadro abajo.
2. **Haz clic dentro del recuadro.** Escribe dos nombres y pulsa **▶ Iniciar**.
3. Juega:
   - **Jugador 1:** `A` `D` moverse · `W` saltar · `F` golpe · `G` patada · `S` bloquear
   - **Jugador 2:** `←` `→` · `↑` saltar · `K` golpe · `L` patada · `↓` bloquear

✅ **Debe pasar:** los muñecos se mueven y se pegan, las barras de vida bajan, y a la derecha aparecen los eventos
(`ATTACK`, `ROUND_END`…). Gana quien gane 2 rondas.

### Paso 3 — Jugar CONTRA LA COMPUTADORA (Prolog)
1. En la tarjeta 🥊 Combate pulsa **▶ Jugar aquí (vs-computadora)**.
2. Clic dentro del recuadro → tu nombre → **▶ Iniciar**. Tú eres el azul (`A` `D` `W` `F` `G` `S`).

✅ **Debe pasar:** el muñeco naranja se mueve **solo**. En la tarjeta **🧠 Lo que piensa la computadora** dice
*"✔ Conectada a SWI-Prolog"* y va mostrando su **decisión** y la **razón** (por ejemplo, *"el rival está atacando de
cerca: me cubro"*). Esas razones vienen de las reglas de `prolog/combate.pl`.
✅ Cumple: *"usuario contra computadora con Prolog"*.

### Paso 4 — Atrapa Estrellas y Adivina el Número
- **⭐ Atrapa Estrellas:** Jugador 1 `A` `D`, Jugador 2 `←` `→`. Dura 60 segundos. ⭐ +1 · 🌟 +3 · 💣 −2.
- **🔢 Adivina el Número:** cada uno escribe un número secreto (1–100) y Enter. Luego se turnan para adivinar el del
  otro; el juego responde "es MAYOR" o "es MENOR".

✅ **Debe pasar:** los dos juegos terminan mostrando al ganador.

### Paso 5 — Varias partidas A LA VEZ
1. Pulsa **Jugar aquí** en 2 o 3 juegos distintos (o 2 veces en el mismo juego).
2. Pulsa **↗ Pestaña nueva** en otro juego: se abre en otra pestaña del navegador.

✅ **Debe pasar:** cada recuadro tiene su propio **matchId** distinto (se ve en la barra de arriba de cada
partida) y cada uno se juega por separado, sin mezclarse.
✅ Cumple: *"varias instancias en paralelo, en la misma consola o en pestañas"*.

### Paso 6 — Ver las estadísticas
1. Pulsa **📊 Estadísticas**, arriba.
2. Revisa cada parte:

| Parte del panel | Qué muestra | Cumple |
|---|---|---|
| **Estadísticas generales** | partidas analizadas, jugadores, eventos recibidos/válidos/rechazados | estadísticas generales |
| **🏆 Récords de todos los juegos** | puntaje más alto, más victorias, victoria más rápida, partida más larga + los récords propios de cada juego | **récords** |
| **Partidas en curso ahora** | las partidas que están abiertas jugándose | en vivo |
| **Estadísticas por juego** | **veces jugado**, **instancias en curso**, **tiempo promedio**, récords y **tabla de posiciones** con las columnas generales + las específicas del juego | por juego + **cantidad de instancias** |
| **Últimas partidas terminadas** | cada partida con su **ganador** | resultados |

✅ **Truco para ver que es "en vivo":** deja una partida abierta en una pestaña y el panel en otra. Juega y
observa cómo cambian los números (se actualiza solo cada 3 segundos; las tarjetas que cambian parpadean).

> Las estadísticas de una partida aparecen **unos segundos después de que termina** (GameStats espera el
> `MATCH_FINISHED`). Mientras se juega, la partida sale en **"Partidas en curso ahora"**.

---

## 4. Prueba EN TU COMPUTADORA (Docker) — para lo "dinámico"

### Paso 1 — Levantar todo
1. Abre **Docker Desktop** y espera a que diga *Engine running*. Si falla por memoria, cierra Discord y Chrome.
2. En PowerShell:
   ```bash
   cd C:\Users\melan\Downloads\proye2
   ```
   ```bash
   docker compose up --build
   ```
   La primera vez tarda varios minutos. Deja esa ventana abierta.
3. Abre **http://localhost:3000**. Haz los mismos pasos 1 a 6 de arriba.

### Paso 2 — Agregar un juego nuevo SIN reiniciar (lo que más pidió el profesor)
1. Con la consola abierta en el navegador, ve a la carpeta `C:\Users\melan\Downloads\proye2\juegos`.
2. **Copia** la carpeta `adivinanza` y pégala ahí mismo. Cámbiale el nombre a `adivinanza2`.
3. Dentro de `adivinanza2`, abre `manifest.json` con el Bloc de notas y cambia:
   - `"id": "adivinanza"` → `"id": "adivinanza2"`
   - `"nombre": "Adivina el Número"` → `"nombre": "Adivina el Número 2"`

   Guarda el archivo.
4. Mira la consola **sin recargar**.

✅ **Debe pasar:** en menos de 4 segundos aparece la tarjeta **"Adivina el Número 2"**. Juégala y luego mira
📊 Estadísticas: GameStats ya tiene sus estadísticas, **sin haber programado nada** para ese juego.
5. Al terminar, **borra** la carpeta `adivinanza2`. También desaparece sola de la consola.

### Paso 3 — Apagar
En la ventana de PowerShell pulsa `Ctrl + C` y luego:
```bash
docker compose down
```

---

## 5. Pruebas automáticas (opcionales, para mostrar en el video)

| Qué | Dónde se ve |
|---|---|
| **CI en GitHub:** pruebas de la consola, de Prolog y de los juegos; construcción de las imágenes Docker; prueba integrada con GameStats | https://github.com/MelanyRodriguezR/GameConsole/actions → la última ejecución con ✅ verde |
| **Prueba integrada en tu PC** (necesita Docker) | `bash scripts/e2e.sh` en la carpeta `proye2` (en Git Bash). Al final dice **✔ Prueba integrada correcta**. |
| **Llenar el panel con partidas de ejemplo** | `node scripts/partidas-demo.js https://gameconsole-w8oh.onrender.com/api/events` (incluye "dardos", un juego inventado que GameStats nunca vio, y aun así le calcula ganador y récords) |

---

## 6. Lista final: ¿qué cumple y qué falta?

| Requisito (enunciado + profesor) | Estado | Cómo comprobarlo |
|---|---|---|
| 3 juegos distintos desde la consola web | ✅ | sección 3, paso 1 |
| POO (clases, encapsulación, herencia) + patrones de diseño | ✅ | README → tabla "Patrones de diseño" |
| Contra la computadora con Prolog | ✅ | sección 3, paso 3 |
| Varias partidas en paralelo (consola y pestañas) | ✅ | sección 3, paso 5 |
| Eventos compatibles con GameStats, sin mezclarse | ✅ | panel: 0 eventos rechazados; cada partida con su matchId |
| Panel: estadísticas generales y por juego, en vivo | ✅ | sección 3, paso 6 |
| Cantidad de instancias de cada juego | ✅ | "veces jugado" e "instancias en curso ahora" |
| Récords y estadísticas específicas | ✅ | "🏆 Récords" y la tabla de posiciones |
| Consola **dinámica** | ✅ | sección 4, paso 2 |
| Repositorio Git con historial | ✅ | https://github.com/MelanyRodriguezR/GameConsole/commits/main |
| Docker | ✅ | sección 4 |
| CI/CD | ✅ | GitHub → Actions (verde) + Render redepliega solo en cada push |
| Deployment | ✅ | https://gameconsole-w8oh.onrender.com |
| Documentación breve | ✅ | `README.md` (instalación, ejecución, deploy y decisiones técnicas) |
| **Video ≤ 15 min con link público** | ❌ **falta** | `docs/GUION-VIDEO.md` |
| **Entrega en el Tec Digital** (viernes 20 antes de las 10 pm) | ❌ **falta** | link del repo + link del video |
