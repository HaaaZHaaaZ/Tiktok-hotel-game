/**
 * Version de la app, visible en pantalla.
 *
 * Motivo: con el despliegue por PortainerArchive el navegador se queda con un
 * bundle viejo en cache mientras el servidor ya sirve otro, y no hay forma de
 * distinguirlo a simple vista. Con la version en pantalla se ve de un vistazo si
 * lo que se esta probando es lo mismo que esta desplegado.
 *
 * IMPORTANTE: subir APP_VERSION en cada despliegue. Es lo primero que hay que
 * mirar si alguien dice "lo veo igual" o "no me ha cambiado nada".
 */
export const APP_VERSION = '2026.11.06-1';

export const APP_VERSION_NOTES = [
  'rendimiento: un like repinta 1 piso en vez del hotel entero (~9x menos trabajo por evento)',
  'fix: el personaje ya no cambia de tamano al andar, bailar o temblar',
  'fix: nombre, insignias y globo ya no salen en espejo al mirar a la izquierda',
  'animacion: paseo por la habitacion fluido (GPU) y llegada con salto',
  'fix: todos entraban como gamer y nadie paseaba; ahora la personalidad sale del nombre',
  'fix: el personaje mira hacia donde camina',
  'seguridad: en produccion sin ADMIN_PASSWORD el panel queda bloqueado (antes entraba con la clave publica)',
  'seguridad: sesion firmada con HMAC-SHA256 y comparacion en tiempo constante',
  'refactor: saneador de estado a modulo puro testeable + id de evento centralizado; sin cambio de comportamiento',
  'fix: un solo hotel compartido, sin hoteles paralelos que se peleen',
  'fix: el tiempo de duracion ya no oscila entre 30 y 10 al configurarlo',
  'fix: las ordenes del panel se aplican de verdad (el codigo era inalcanzable)',
  'hotel mas ancho: ocupa todo el borde, con margen para ver el clima',
  'fix conexion: bufferutil dejaba el socket muerto a los ~20s',
  'globos de comentarios: uno solo, 2.8s sobre su autor',
  'contador de likes por usuario en su habitacion',
  'desalojo: el personaje cae por la fachada',
  'recompensas de tiempo: likes +0.3s, regalos +1s, compartir +0.5s',
  'superpoderes cada 100 likes, con rayo animado origen -> destino',
  'suite progresiva: +1 habitacion cada 500 likes (max 4 = piso entero)',
  'comandos de poder por chat (!regen, !escudo, !iman, !aura, !suite)',
  'comandos de poder integrados en el banner superior',
  'Don Pepe se estresa con mas de 5 en fila: ojos rojos, sudor y badge PRISA',
  'fix: suite 4/4 ya no crea una fila extra de habitaciones',
  'poderes: rastro de energia + el receptor tiembla con su habitacion',
  'sincronia entre dispositivos: estado canonico en el servidor + un solo dueno',
  'licencia PolyForm Noncommercial: se puede usar y mejorar, no vender',
  'guia para agentes de IA (AGENTS.md) + historico de versiones',
  'fix: el hotel ya no tiembla al construir o derribar un piso (bucle de autoescalado)',
  'regalos: repisa de trofeos permanente en la habitacion + aura en el personaje',
  'regalos: el tiempo de estadia ahora escala con el VALOR donado (diamantes reales)',
  'login de admin + fix: recargar la pagina ya no crea una sesion nueva',
  'fix: el hotel ya no parpadea con cada evento del live (eco de estado)',
  'watchdog: los personajes atascados en el pasillo vuelven solos a su habitacion',
  'fix: fila de Don Pepe desbordada por eventos member',
  'fix: estado viejo tumbaba la app en movil/tablet',
] as const;
