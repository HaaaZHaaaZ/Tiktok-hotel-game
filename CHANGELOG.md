# Histórico de versiones

Todas las versiones notables de TikTok Hotel. El formato es
`YYYY.MM.DD-N`, donde `N` es el número de despliegue de ese día.

La versión se muestra en pantalla, arriba a la izquierda del HUD, para poder
comprobar de un vistazo que lo desplegado es lo que se está probando.

> **Nota:** las fechas son las del desarrollo del proyecto. El historial se
> empezó a documentar de forma retroactiva, a partir de los cambios ya
> desplegados.

---

## 2026.10.09-11 — Licencia sin uso comercial

- **Cambio de licencia: de MIT a PolyForm Noncommercial 1.0.0.** MIT permitía
  vender el software; el objetivo del proyecto es que se use y se mejore, no que
  se revenda.
  - **Se puede:** usar (también en directos monetizados), modificar, crear obras
    derivadas y compartir bajo las mismas condiciones.
  - **No se puede:** venderlo, cobrar por instalarlo/alojarlo/dar soporte, ni
    usarlo dentro de una empresa con ánimo de lucro.
  - Se conserva el copyright y el texto íntegro de la licencia oficial.
- Sección de **contribuir** en el README: las mejoras se piden por *pull
  request*, sin obligar.

> Nota: al restringir el uso comercial, esta licencia **ya no es de código
> abierto** según la definición de la OSI (que exige no discriminar por campo de
> aplicación). Sigue siendo software de fuente abierta y de uso libre para
> cualquier fin no comercial.

---

## 2026.10.09-10 — Licencia abierta y documentación

- **Licencia MIT**: el proyecto pasa a ser software libre — se puede usar,
  modificar y redistribuir, conservando el aviso de copyright. Incluye un aviso
  sobre `tiktok-live-connector` (librería no oficial de terceros).
- **`AGENTS.md`**: guía escrita para que un agente de IA pueda instalar,
  ejecutar y modificar el proyecto sin adivinar. Incluye el mapa del código, las
  diez reglas que no se deben romper y el diagnóstico de los fallos conocidos.
- **`CHANGELOG.md`**: este histórico.
- Créditos del autor y de Hermes Agent en el README.

---

## 2026.10.09-9 — Sincronía entre dispositivos

**El problema:** `BroadcastChannel` y `localStorage` solo alcanzan al **mismo
navegador**. El PC y el móvil mostraban hoteles distintos, y cada pestaña
aplicaba los eventos del live por su cuenta.

- **Estado canónico en el servidor** (`globalThis` + `/api/hotel/sync`): todas
  las pantallas comparten un único hotel.
- **Un solo propietario**: únicamente una pantalla aplica los eventos del live y
  corre el reloj de estadía. Sin esto, un espectador entraba una vez por pestaña
  abierta (con avatar distinto en cada una) y el reloj corría N veces más rápido.
- **Traspaso automático**: si la pantalla que manda deja de latir (cerrada, móvil
  bloqueado), otra toma el control sola en ~10 s.
- **Los cambios del panel viajan siempre**, aunque se hagan desde una pantalla
  espejo, para que se vean al instante en todas.
- **Indicador en el HUD**: `🟢 EN VIVO` (manda) · `🔵 ESPEJO` (sigue) ·
  `⚪ SIN SYNC`, con el número de pantallas conectadas.
- **Siembra automática**: tras reiniciar el servidor, la primera pantalla que
  abre vuelve a publicar el estado para que el hotel no se quede vacío.

**Corregido de paso:** el script de despliegue borraba el contenedor viejo y
creaba el nuevo con el mismo nombre; si el borrado tardaba, el `create` daba
`409 nombre en uso` y el hotel se quedaba **sin contenedor**. Ahora reintenta el
borrado y verifica HTTP real (incluidos los assets) antes de dar el despliegue
por bueno.

---

## 2026.10.09-8 — Suite 4/4 y poderes con impacto

**El problema:** al llegar la suite a 4/4, el piso mostraba **más de 4
habitaciones**. Las absorbidas reaparecían como recuadros sueltos en una fila
nueva.

- **Causa:** el render deducía que una habitación estaba absorbida mirando al
  *residente* (`occupant.expandedRoomIds`). Al desalojar al vecino se limpiaba su
  `occupantId`, el ocupante pasaba a `undefined`, el check fallaba y la
  habitación se volvía a dibujar.
- **Arreglo:** la marca ahora vive en la **habitación** (`Room.absorbedBy`), no
  en el residente. Además, `evictResident` ya no libera habitaciones que tienen
  otro dueño.
- **Poderes:** el receptor ahora **tiembla** (personaje y habitación), su cuarto
  se ilumina con el color del poder y aparece un aviso `⚡ ¡PODER RECIBIDO!`.
- **Nuevo rastro de energía** que une emisor y receptor, con el ángulo y la
  distancia reales medidos en el DOM: se ve de dónde sale y a dónde va antes de
  que llegue el proyectil.

---

## 2026.10.09-7 — Don Pepe se estresa

- Con **más de 5 personas en fila**, Don Pepe cambia de expresión: ojos rojos
  temblorosos, boca ondulada, gotas de sudor animadas y un badge rojo `¡PRISA!`.
- El indicador de fila del mostrador pasa a rojo pulsante.
- Con 5 o menos, Don Pepe vuelve a su sonrisa habitual.

---

## 2026.10.09-6 — Rollback del banner lateral

- **Eliminada** la etiqueta lateral de comandos: ocupaba demasiado ancho y le
  robaba espacio al edificio (en móvil se salía de pantalla).
- Los **comandos de poder pasan al banner superior**, junto a los comandos
  normales, que ya tenían sitio.
- Nuevo módulo compartido `services/powerCommands.ts` para que el banner y el
  chat lean los comandos de la misma fuente (y no se desincronicen).

---

## 2026.10.09-5 — Etiqueta lateral legible

- La etiqueta de comandos era **ilegible**: texto rotado en vertical dentro de
  una franja de 28 px. Solo se veían números y un corazón suelto.
- Pasa a **texto horizontal** en una columna más ancha, con una cabecera que
  explica qué es (`⚡ PODERES · Escríbelos en el chat`) y el **nombre de cada
  poder**, no solo su coste.
- Se corrigió el layout para que quepa en móvil (390 px), tablet y escritorio.

---

## 2026.10.09-4 — Suite progresiva

- La suite crece **de una en una**: +1 habitación por cada 500 likes
  (500 → 2, 1000 → 3, 1500 → 4). Tope duro de 4: un piso entero.
- **Bug corregido:** la ampliación iba *una tanda por detrás* (expandía a los
  1000 en vez de a los 500). La causa era leer `stateRef.current` justo después
  de un `setState` del mismo tick, que todavía tenía el valor viejo.

---

## 2026.10.09-3 — Superpoderes y comandos

- **Superpoderes cada 100 likes**: regeneración, escudo, imán, aura y habitación
  doble.
- **Se lanzan por comandos de chat** (`!regen`, `!escudo`, `!iman`, `!aura`,
  `!suite`), solo si el residente ya desbloqueó el poder. Si no, aviso `🔒`.
- El poder viaja con una animación de origen a destino.
- **Recompensas de tiempo** en segundos reales: like +0.3 s, regalo +1 s,
  compartir +0.5 s.
- **Desalojo animado**: el personaje cae por la fachada.
- **Contador de likes** por usuario dentro de su habitación; vuelve a 0 al irse.

---

## 2026.10.09-2 — Estabilidad y comentarios

- **Bug corregido (`bufferutil`)**: el socket de TikTok moría a los ~20 s con
  `b.mask is not a function`. La dependencia nativa opcional de `ws` se resolvía
  a un módulo vacío en el bundle. Se marca como externa y se añaden las banderas
  `WS_NO_*` antes de cargar Next.
- **Burbujas de comentario**: salían dos superpuestas. Ahora hay una sola, sobre
  su autor, y desaparece a los ~2.8 s.
- **Fila de Don Pepe**: llegaba a 130+ personas con 60 espectadores, porque cada
  evento `member` metía a alguien. Se acota por la capacidad real de habitaciones.

---

## 2026.10.09-1 — Robustez en móvil

- **Bug corregido**: un estado guardado de una versión anterior tumbaba la app
  entera en móvil y tablet (`Application error: a client-side exception`).
  Ahora el estado se **sanea al cargar**, en un solo sitio, y las páginas van
  envueltas en un `ErrorBoundary` con botón de «Limpiar y recargar».

---

## 2026.10.04 — Conexión directa a TikTok LIVE

Primera versión funcional con eventos reales.

- Conexión al live con `tiktok-live-connector` (sin claves, autoalojado).
- La conexión vive en el **servidor**; el navegador solo lee eventos, para que
  el WebSocket sobreviva a las navegaciones entre `/` y `/admin`.
- Comentarios, regalos, likes, compartidos y entradas, en pantalla.
- Panel de administración con registro de diagnóstico.
- Edificio que crece: al llenarse un piso se construye otro encima.

---

## 2026.10.03 — Estructura inicial

- Estructura del proyecto (Next.js 15 + React 19 + Tailwind 4).
- Modelo de datos del hotel: pisos, habitaciones, residentes.
- Primeras mecánicas: entrada por comentario, habitación asignada, subida en
  ascensor.
