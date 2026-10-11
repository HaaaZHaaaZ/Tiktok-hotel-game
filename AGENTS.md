<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# Guía del proyecto para agentes de IA

Lo de arriba lo escribe `next dev` automáticamente. Lo de abajo es de este
proyecto: léelo antes de tocar nada.

Aplicación **Next.js 15** (App Router) que renderiza un hotel 2D interactivo
alimentado por eventos de un directo de TikTok. No hay base de datos: el estado
vive en memoria del servidor y se sincroniza a los clientes.

| Dato | Valor |
|---|---|
| Framework | Next.js 15.5 · React 19 |
| Estilos | Tailwind CSS 4 |
| Salida de build | `output: 'standalone'` |
| Runtime de las rutas API | **`nodejs`** (obligatorio: `ws`/protobuf no van en Edge) |
| Puerto | 3000 |
| Estado | En memoria (`globalThis`) + `localStorage` como caché |
| Dependencia externa crítica | `tiktok-live-connector` (no oficial) |

## Instalación

```bash
npm install
npm run dev          # http://localhost:3000
```

**No hace falta ninguna clave de API.** La conexión con TikTok es autoalojada.

Comprobar que arrancó bien (el HTML **y** los assets deben dar 200):

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/
curl -s http://localhost:3000/ | grep -o '/_next/static/[^"]*' | head -3
```

Si el HTML responde 200 pero los `/_next/static/...` dan 404, la página sale en
blanco: el build está bien y lo que falta es copiar `.next/static` dentro de
`.next/standalone` (ver «Build y despliegue»).

## Mapa del código

```
app/
  page.tsx                       Pantalla del LIVE
  admin/page.tsx                 Panel del streamer
  api/tiktok/connect/route.ts    Abre/cierra el WebSocket con TikTok
  api/tiktok/webhook/route.ts    GET: eventos nuevos · POST: ingesta manual
  api/hotel/sync/route.ts        Sincronía del estado entre dispositivos
context/
  HotelContext.tsx               TODO el estado del juego y su lógica (~2800 líneas)
services/
  hotelSync.ts                   Cliente de sincronía (navegador)
  hotelSyncStore.ts              Estado canónico (servidor, en globalThis)
  tiktok/liveBridge.ts           Conexión con TikTok (servidor)
  tiktokLiveConnector.ts         Polling y reenganche (navegador)
  powerCommands.ts               Comandos de los superpoderes
  hotelService.ts                Creación de pisos y habitaciones
types/hotel.ts                   Modelo de datos
components/hotel/                Render: edificio, pisos, habitaciones, personajes
```

**Punto de entrada para casi cualquier cambio de comportamiento:**
`context/HotelContext.tsx` (entrada de espectadores, regalos, superpoderes,
reloj de estadía, desalojos).

## Reglas que NO se deben romper

Cada una viene de un fallo real que costó tiempo. Están explicadas en el propio
código; respétalas al modificar.

1. **La señal de vida son los EVENTOS, no `connect()`.** En Alpine/musl,
   `connect()` rechaza con `b.mask is not a function` aunque el socket funcione.
   Fija `state='connected'` dentro del handler de cada evento.

2. **Todo estado de servidor va en `globalThis`.** Las rutas de Next recargan su
   módulo en cada petición: una variable de módulo se pierde.

3. **El reloj del servidor es la única fuente de verdad** para el cursor de
   lectura de eventos. Mezclar `Date.now()` del navegador con los timestamps del
   servidor envenena el cursor y los eventos dejan de llegar para siempre.

4. **No reconectar por silencio.** Un live tranquilo no emite, y eso es normal.
   Un socket solo está muerto si falla el ping.

5. **`bufferutil` debe quedar como dependencia externa.** Es una dependencia
   nativa *opcional* de `ws`. Si el bundler la resuelve a un módulo vacío, el
   socket muere a los ~20 s. Ver `next.config.ts` y las banderas `WS_NO_*`.

6. **Solo el propietario aplica lo automático.** En la sincronía entre
   dispositivos, una sola pantalla aplica los eventos del live y corre el reloj.
   Si cada pestaña lo hiciera, un espectador entraría una vez por pestaña y el
   reloj correría N veces más rápido.

7. **La marca de pertenencia va en la entidad poseída.** Cuando una habitación es
   absorbida por una suite, la marca vive en la **habitación**
   (`Room.absorbedBy`), no en el residente: si el residente desaparece, la
   habitación quedaría huérfana y visible.

8. **Sanear el estado restaurado al cargar**, no parchear cada lectura. Un estado
   viejo (sin un campo nuevo) puede tumbar la app entera.

9. **Reutilizar el espacio de UI existente antes de añadir paneles.** Los paneles
   laterales le roban ancho al edificio y en móvil lo sacan de pantalla.

10. **Subir `APP_VERSION` en cada despliegue.** Es lo primero que hay que mirar
    si alguien dice «lo veo igual».

## Build y despliegue

```bash
npm run build
```

Genera `.next/standalone` (servidor) y `.next/static` (assets).

> **Trampa frecuente:** `output: 'standalone'` **no incluye** `.next/static`.
> Cópialo dentro antes de arrancar:
> ```bash
> cp -r .next/static .next/standalone/.next/static
> ```
> Sin eso, el HTML se sirve pero los assets dan 404 y la página sale en blanco.
> Es el error más común y el más engañoso: parece un fallo de lógica y no lo es.

Ejecutar el standalone:

```bash
PORT=3000 HOSTNAME=0.0.0.0 node .next/standalone/server.js
```

Docker: usa `output: 'standalone'`, copia `.next/standalone` → `/app` **y**
`.next/static` → `/app/.next/static`. `COPY /app/public` solo si el proyecto
**tiene** ese directorio (Next no lo crea si no existe y el build falla).

Verificar un despliegue — un contenedor `running` no prueba nada:

```bash
curl -s http://<host>:3000/ | grep -o '/_next/[^"]*' | while read a; do
  echo "$(curl -s -o /dev/null -w '%{http_code}' http://<host>:3000$a)  $a"
done   # todos deben dar 200
```

## Verificar sin un live

No hace falta un directo para probar. Ingesta manual:

```bash
curl -s -X POST http://localhost:3000/api/tiktok/webhook \
  -H 'Content-Type: application/json' \
  -d '{"event":"comment","username":"@prueba1","comment":"!entrar"}'

# 1500 likes: desbloquea todos los superpoderes y amplía la suite a 4/4
curl -s -X POST http://localhost:3000/api/tiktok/webhook \
  -H 'Content-Type: application/json' \
  -d '{"event":"like","username":"@prueba1","likeCount":1500}'

# Lanzar un poder (el residente debe tenerlo desbloqueado)
curl -s -X POST http://localhost:3000/api/tiktok/webhook \
  -H 'Content-Type: application/json' \
  -d '{"event":"comment","username":"@prueba1","comment":"!escudo"}'
```

Eventos aceptados: `comment`, `gift`, `like`, `share`, `follow`.

Leer el estado:

```bash
curl -s 'http://localhost:3000/api/hotel/sync?since=0&clientId=probe'   # canónico
curl -s http://localhost:3000/api/tiktok/connect                       # conexión
curl -s 'http://localhost:3000/api/tiktok/log?format=text'             # diagnóstico
```

### Trampas al verificar en el navegador

- **Inyectar estado a mano en `localStorage` puede corromper la app.** Si el
  objeto no tiene la estructura esperada, el `ErrorBoundary` muestra «El hotel
  tuvo un problema al dibujarse». No es un bug del código: borra el
  `localStorage` y recarga.
- **Las animaciones de ~1.4 s ya expiraron cuando mides.** Mide **inmediatamente**
  después de inyectar el evento (~1 s), no 3 s después, o verás 0 y parecerá
  que no funciona.
- **Dos pestañas del mismo navegador comparten `localStorage`**, así que ver el
  mismo valor en ambas **no prueba** que la sincronía funcione. La prueba que
  vale: borrar el `localStorage` y recargar; si el estado reaparece, viene del
  servidor.

## Tareas habituales

**Añadir un superpoder:**
1. `types/hotel.ts` → `SuperpowerId` y `SUPERPOWERS` (con `likesRequired`,
   icono y `beamColor`).
2. `services/powerCommands.ts` → su comando de chat.
3. `context/HotelContext.tsx` → el efecto, en `lanzarPoder` (busca
   `if (powerId === 'regen')`).

El banner de comandos y el chat leen de la misma fuente, así que no hay que
tocarlos.

**Cambiar cuándo se amplía la suite:** `ROOM_EXPANSION_THRESHOLDS` en
`HotelContext.tsx`. Es una lista de umbrales de likes; `habitacionesPorLikes()`
cuenta cuántos se han superado. El tope duro de 4 (un piso entero) está en esa
misma función.

**Cambiar la duración de una burbuja o un efecto:** `BUBBLE_MS` y `POWER_HIT_MS`.
Ojo: `POWER_HIT_MS` aparece en `HotelContext.tsx`, `CharacterRenderer.tsx` y
`RoomRenderer.tsx` — **los tres deben coincidir**, y con la duración de
`.animate-power-shock` / `.animate-room-shock` en `app/globals.css`.

## Diagnóstico rápido

| Síntoma | Qué mirar |
|---|---|
| Dejan de llegar eventos | `uptimeMs` del endpoint `connect` entre dos lecturas: si baja, el socket murió |
| Los contadores suben pero el hotel no muestra nada | `polls` y `pollAgeSec`: si `polls` no sube, el **navegador** dejó de leer |
| `b.mask is not a function` | `bufferutil` resuelto a módulo vacío en el bundle |
| Página en blanco con HTML 200 | Los `/_next/static/...` dan 404 → falta copiar `.next/static` |
| `Application error: a client-side exception` | Estado guardado viejo → borrar `localStorage` |
| Habitación `OCUPADA` con `occupantId: null` | Liberar por ocupante, no por campo declarado |
| Más de 4 habitaciones en un piso | `Room.absorbedBy` sin marcar (ver regla 7) |
| Dos pantallas muestran hoteles distintos | Sin propietario, o el eco devolviendo el estado al servidor |
| El hotel se queda vacío tras reiniciar | Nadie sembró el servidor (`onSeedNeeded`) |

## Cómo contribuir

1. Un cambio, un commit. Explica **por qué**, no solo qué.
2. Si arreglas un bug, deja en el código el síntoma que producía. Este proyecto
   documenta sus fallos a propósito: es lo que evita que vuelvan.
3. Sube `APP_VERSION` en `version.ts` y añade la entrada al `CHANGELOG.md`.
4. Verifica con HTTP real antes de dar nada por hecho.

Convención de versiones: `YYYY.MM.DD-N` (fecha y número de despliegue del día).
Se muestra en pantalla.

## Licencia y créditos

MIT — puedes usarlo, modificarlo y redistribuirlo. Ver `LICENSE`.

- **Autor:** Brayan Lopez ([@HaaaZHaaaZ](https://github.com/HaaaZHaaaZ))
- **Desarrollado con:** [Hermes Agent](https://hermes-agent.nousresearch.com)
  (Nous Research)
