# Guion del video (≤ 15 minutos)

Antes de grabar: `docker compose up --build` (o abrir las URLs de Render y esperar 1 minuto).
Tener abiertas la consola (http://localhost:3000) y esta guía.

| Min | Qué mostrar | Qué decir |
|---|---|---|
| 0:00 – 1:00 | Portada: la consola | Qué es GameConsole: consola web con 3 juegos POO, IA en Prolog y estadísticas de GameStats (Proyecto 1). Mostrar el diagrama del README. |
| 1:00 – 3:00 | **Consola dinámica** | La consola no conoce ningún juego: lee los `manifest.json` de la carpeta `juegos/`. Demostración: copiar una carpeta de juego (por ejemplo, duplicar `adivinanza` como `adivinanza2` cambiando el `id` en su manifiesto) y ver que aparece en ≤ 4 s **sin reiniciar**. También "Agregar un juego nuevo" por URL. Borrarla después. |
| 3:00 – 5:00 | 🥊 **Combate** (2 jugadores) | Moverse, saltar, golpe, patada, bloqueo. La bitácora muestra los eventos `ATTACK` / `ROUND_END` con su `matchId`. |
| 5:00 – 7:30 | 🥊 **Combate contra la computadora** | La tarjeta "Lo que piensa la computadora" muestra la decisión y la razón que da Prolog. Abrir `prolog/combate.pl` y explicar las reglas en orden de prioridad (KO → bloquear → huir → esperar → mejor ataque con búsqueda de valor). Evento `AI_DECISION`. |
| 7:30 – 8:30 | ⭐ **Atrapa Estrellas** | Polimorfismo (estrella, dorada, bomba) y Factory. |
| 8:30 – 9:30 | 🔢 **Adivina el Número** | Patrón State (fases), secreto privado `#secreto`. |
| 9:30 – 11:00 | **Partidas en paralelo** | Abrir 3 partidas a la vez en la consola y una en **pestaña nueva**. Cada una tiene su `matchId`. Mostrar `http://localhost:8080/matches` (ingest) con varias partidas en curso a la vez. |
| 11:00 – 12:30 | 📊 **Panel** | Estadísticas generales (partidas, jugadores, eventos), **🏆 récords de todos los juegos** y, por juego, veces jugado, tiempo promedio, récords, tabla de posiciones y partidas en curso. Se actualiza solo cada 3 s. Recalcar: **el panel no calcula, todo viene de GameStats**. Mostrar el método `estadisticas()` de un juego: el juego **declara** qué medir y GameStats lo calcula con un solo analizador dinámico; "dardos" (de `partidas-demo.js`) es un juego que GameStats nunca vio y aun así tiene récords. |
| 12:30 – 14:00 | **Código y patrones** | Recorrer rápido la tabla de patrones del README señalando el archivo de cada uno. |
| 14:00 – 15:00 | **DevOps** | GitHub Actions en verde (pruebas, imágenes, prueba integrada), `docker-compose.yml`, `render.yaml` y la consola funcionando en Render. |

Tip: `node scripts/partidas-demo.js http://localhost:3000/api/events` manda partidas de los 3 juegos en
paralelo para que el panel tenga datos desde el inicio.
