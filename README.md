# 🏨 TikTok Hotel — Juego Interactivo para TikTok LIVE

Hotel virtual 2D en tiempo real que se construye con la audiencia de un directo de
TikTok. Los espectadores entran comentando, reciben una habitación, suben de piso,
ganan superpoderes con sus likes y pueden ser desalojados (literalmente: caen por
la fachada).

Pensado para emitir en vertical (9:16), como capa visual de un LIVE de TikTok.

---

## ✨ Qué hace

- **Entrada por el chat.** Quien comenta entra al hotel: Don Pepe lo recibe en
  planta baja, le asigna habitación y lo sube en ascensor con un tour por los
  pisos.
- **Edificio que crece.** Cuando un piso se llena, se construye otro encima. Los
  pisos superiores se derriban solos cuando quedan vacíos.
- **Eventos del live en pantalla.** Comentarios en globos sobre su autor, regalos
  con efectos, likes, compartidos y follows.
- **Superpoderes por likes.** Uno cada 100 likes, que se lanzan con un rayo
  animado sobre otro residente.
- **Habitación ampliable.** Cada 500 likes el residente absorbe una habitación
  contigua, hasta juntar las 4 del piso (un piso entero).
- **Desalojos.** Cuando se acaba la estadía, el personaje sale expulsado por la
  ventana y cae rebotando hasta la calle.
- **Panel de administración.** Control del streamer: conectar el live, reglas de
  entrada, eventos globales, clima, demoliciones y registro de diagnóstico.

---

## 🎮 Comandos del chat

Los espectadores los escriben en el chat del LIVE. Aparecen en el banner superior
de la app.

### Comandos básicos

| Comando | Qué hace |
|---|---|
| `!entrar` | Consigue tu habitación gratis |
| *cualquier comentario* | Habla con burbuja sobre tu personaje (+6% estabilidad) |
| `!bailar` | Tu personaje baila |
| `!dormir` | Descansa y recupera energía |
| `!pc` / `!jugar` | Enciende la computadora gamer RGB |
| `!tv` | Mira la transmisión en la tele de tu habitación |

### Regalos

| Regalo | Efecto |
|---|---|
| 🌹 Rosa | +15 Energía, +20 Estabilidad |
| 🐶 Corgi | Decoración temática |
| 🚀 Cohete | Sube la habitación a PREMIUM |
| 👑 Corona / 🦁 León | Acceso al VIP Penthouse |

### Superpoderes

Se desbloquean **cada 100 likes** y se lanzan sobre otro residente al azar con una
animación que muestra de quién sale y a quién llega.

| Comando | Likes | Poder |
|---|---|---|
| `!regen` | 100 | 💚 Regeneración — su estadía se recupera sola |
| `!escudo` | 200 | 🛡️ Escudo — sus likes valen el doble |
| `!iman` | 300 | 🧲 Imán de Regalos — los regalos suman el triple |
| `!aura` | 400 | ✨ Aura — contagia estadía a los vecinos del piso |
| `!suite` | 500 | 🏰 Habitación Doble — +1 habitación por cada 500 likes |

---

## 🏗️ Cómo está hecho

| Pieza | Tecnología |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 |
| Estilos | Tailwind CSS 4 |
| Estado | React Context + `localStorage` (con saneado al cargar) |
| Eventos del live | [`tiktok-live-connector`](https://www.npmjs.com/package/tiktok-live-connector) v2.5 |
| Sincronía entre pestañas | `BroadcastChannel` |
| Audio | Web Audio API (sin ficheros) |

### Arquitectura de la conexión

La conexión con TikTok vive en el **servidor** (un WebSocket en un singleton de
`globalThis`); el **navegador** solo hace polling del endpoint de eventos. Esa
separación es deliberada: el WebSocket sobrevive a las navegaciones entre `/` y
`/admin`, y el cliente puede reengancharse solo.

```
Navegador  ──POST /api/tiktok/connect──▶  Bridge (globalThis)
   │                                          │
   │                                     WebSocket ──▶ TikTok LIVE
   │                                          │
   └──GET /api/tiktok/webhook?since=ts──◀  buffer de eventos
```

| Ruta | Para qué |
|---|---|
| `POST /api/tiktok/connect` | Abre el WebSocket a un streamer |
| `GET /api/tiktok/webhook` | Eventos nuevos + estado de la conexión |
| `POST /api/tiktok/webhook` | Ingesta manual (pruebas sin live) |
| `GET /api/tiktok/log` | Registro de diagnóstico del servidor |

---

## 🚀 Ponerlo en marcha

```bash
npm install
npm run dev
```

Abre `http://localhost:3000`. La app arranca **sin live**: en el panel de
administración (`/admin`) hay botones para simular usuarios, comentarios, regalos
y eventos globales.

### Conectar un live real

1. Ve a `/admin`.
2. En **Conector TikTok LIVE**, escribe el usuario del streamer (sin `@`).
3. Pulsa conectar. Si el usuario está en directo, los eventos entran solos.

> **Nota:** `tiktok-live-connector` es una librería no oficial. Cuando TikTok
> cambia su protocolo, deja de funcionar hasta que se actualiza la librería.

---

## 🐳 Despliegue

La app se construye con `output: 'standalone'` y se sirve con Node. Hay dos
detalles que importan en producción:

**1. `bufferutil` debe quedar como dependencia externa.** Es una dependencia
nativa *opcional* de `ws`. Si el bundler la resuelve a un módulo vacío, el socket
de TikTok muere a los ~20 segundos con `b.mask is not a function`. Ver
`next.config.ts`.

**2. Las banderas `WS_NO_*` van antes de `require('next')`.** Refuerzan lo
anterior en tiempo de ejecución:

```js
process.env.WS_NO_BUFFER_UTIL = '1';
process.env.WS_NO_UTF_8_VALIDATE = '1';
```

### Docker

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

> El `COPY` de `.next/static` es **imprescindible**: sin él el HTML se sirve pero
> los assets dan 404 y la página sale en blanco.

---

## 📁 Estructura

```
app/
  page.tsx                    Pantalla del LIVE
  admin/page.tsx              Panel del streamer
  api/tiktok/                 connect · webhook · log · report
components/
  hotel/
    HotelView.tsx             Composición del edificio
    FloorRenderer.tsx         Un piso (4 habitaciones)
    RoomRenderer.tsx          Una habitación
    CharacterRenderer.tsx     El personaje (SVG)
    EvictionOverlay.tsx       Caída por desalojo
    PowerCastOverlay.tsx      Rayo de poder origen → destino
    CommandsAnnouncementBar.tsx  Banner de comandos
  ErrorBoundary.tsx           Aísla fallos de render
context/
  HotelContext.tsx            Estado del juego y toda la lógica
services/
  tiktok/liveBridge.ts        Conexión con TikTok (servidor)
  tiktokLiveConnector.ts      Polling y reenganche (navegador)
  powerCommands.ts            Comandos de los superpoderes
types/hotel.ts                Modelo de datos
```

---

## 🧠 Notas de diseño

Cosas que costaron tiempo y conviene no volver a romper:

- **La señal de vida son los eventos, no `connect()`.** En Alpine/musl
  `connect()` puede rechazar aunque el socket funcione; el estado se fija en el
  handler de cada evento.
- **Todo estado de servidor va en `globalThis`.** Las rutas de Next recargan su
  módulo en cada petición: una cola en el ámbito del módulo se pierde.
- **El reloj del servidor manda.** Mezclar `Date.now()` del navegador con los
  timestamps del servidor envenena el cursor de lectura y los eventos dejan de
  llegar para siempre.
- **El estado guardado se sanea al cargar.** Un estado de una versión anterior
  (sin un campo nuevo) puede tumbar la app entera. Se normaliza en un solo sitio
  en vez de proteger cada lectura.
- **Un personaje, un nodo.** La suite expandida se dibuja como un bloque ancho;
  las habitaciones absorbidas no se renderizan, para no duplicar al personaje.

---

## 📄 Licencia

Proyecto privado. Todos los derechos reservados.
