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
export const APP_VERSION = '2026.10.09-8';

export const APP_VERSION_NOTES = [
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
  'fix: fila de Don Pepe desbordada por eventos member',
  'fix: estado viejo tumbaba la app en movil/tablet',
] as const;
