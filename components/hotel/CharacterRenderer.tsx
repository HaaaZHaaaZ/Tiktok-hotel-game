'use client';

import React from 'react';
import { Resident, ResidentAvatar, SUPERPOWERS } from '../../types/hotel';
import { useRerenderAt } from './useRerenderAt';

interface CharacterRendererProps {
  resident: Resident;
  scale?: number;
  showName?: boolean;
  /** Mirar a la izquierda: se voltea SOLO el cuerpo, no el nombre ni los globos. */
  flip?: boolean;
}

/** Debe coincidir con la duracion de `.animate-power-shock` en globals.css. */
const POWER_HIT_MS = 1400;

/** Duracion de la celebracion de un regalo (aura + salto). */
const GIFT_CELEBRATION_MS = 4000;

const CharacterRendererBase: React.FC<CharacterRendererProps> = ({
  resident,
  scale = 1,
  showName = true,
  flip = false,
}) => {
  // Repintar justo cuando acaban el impacto de poder y la celebracion del regalo.
  useRerenderAt(
    resident?.powerHit ? (resident.powerHit.at || 0) + POWER_HIT_MS : null,
    resident?.giftAt ? resident.giftAt + GIFT_CELEBRATION_MS : null
  );

  // Red de seguridad: un residente corrupto no debe tumbar la pagina entera.
  // Este componente se dibuja dozens de veces por frame; si uno falla, React
  // desmonta el arbol y los personajes desaparecen. Se sale con un null.
  if (!resident) return null;

  const { personality, currentAction, stability, vipLevel, speechBubble } = resident;

  // Un residente puede llegar SIN avatar: los que ya estaban guardados en
  // localStorage se crearon antes de que el avatar formara parte del modelo, y
  // al leer `avatar.outfitColor` de undefined la pagina reventaba con
  // "Cannot read properties of undefined (reading 'outfitStyle')" en CADA render
  // (lo que hacia que no se vieran bien los personajes ni entraran los nuevos).
  //
  // Se rellena un avatar por defecto en memoria. El siguiente guardado ya
  // persiste el avatar completo, asi que el problema desaparece solo.
  //
  // OJO: `??` solo cubre null/undefined, no un avatar PARCIAL (`{skinColor}` sin
  // el resto). El merge con el objeto por defecto cubre ambos casos: asi
  // `avatar.outfitStyle` nunca es undefined y los `=== 'suit'` de mas abajo no
  // pueden reventar.
  const AVATAR_DEFECTO: ResidentAvatar = {
    skinColor: '#F5CBA7',
    hairStyle: 'sleek',
    hairColor: '#2C1810',
    outfitStyle: 'casual',
    outfitColor: '#3498DB',
    accessory: 'none',
    eyeType: 'normal',
  };
  const avatar: ResidentAvatar = {
    ...AVATAR_DEFECTO,
    ...(resident.avatar && typeof resident.avatar === 'object' ? resident.avatar : {}),
  };

  // Un residente restaurado de una version anterior puede venir sin displayName.
  const displayName =
    typeof resident.displayName === 'string' && resident.displayName.trim()
      ? resident.displayName
      : `@${resident.username || 'espectador'}`;

  // Stability warning: time running out / stress detection
  const isCritical = stability <= 15;
  const isExpiring = stability <= 35 && !isCritical;
  const isLow = stability <= 50 && !isExpiring && !isCritical;
  const isStressed = isCritical || isExpiring || currentAction === 'worried';

  // Impacto de poder recien recibido: tiembla con fuerza unos instantes.
  // La marca expira sola por tiempo, asi que no hace falta limpiarla.
  const hit = resident.powerHit;
  const isPowerHit = !!hit && Date.now() - (hit.at || 0) < POWER_HIT_MS;

  // --- Regalos ---
  //
  // `giftCount` decide la intensidad del aura: quien ha recibido mas regalos
  // brilla mas. Es permanente mientras este dentro, para que su aporte se siga
  // viendo mucho despues de la animacion.
  const giftCount = resident.giftCount || 0;
  const giftLevel = Math.min(5, giftCount);
  const isGiftCelebrating = !!resident.giftAt && Date.now() - resident.giftAt < GIFT_CELEBRATION_MS;

  // Animation classes based on action and stress
  // Cada accion tiene su propio movimiento (ver "ACCIONES DEL PERSONAJE" en
  // globals.css). `char-act` ancla las transformaciones a los pies, para que
  // aplastarse y estirarse se vea como un cuerpo apoyado en el suelo.
  let animClass = 'char-act';
  if (isGiftCelebrating) {
    // Salto de celebracion: manda durante unos segundos.
    animClass += ' animate-char-celebrate';
  } else if (isPowerHit) {
    // Temblor violento: manda sobre cualquier otra animacion.
    animClass += ' animate-power-shock';
  } else if (isCritical) {
    animClass += ' animate-[shake_0.25s_ease-in-out_infinite]';
  } else if (isExpiring) {
    animClass += ' animate-[wiggle_0.4s_ease-in-out_infinite]';
  } else {
    const POR_ACCION: Partial<Record<string, string>> = {
      dancing: 'animate-char-dance',
      celebrating: 'animate-char-celebrate',
      walking: 'animate-char-walk',
      // Antes era `animate-pulse` (el personaje se desvanecia y volvia).
      gaming: 'animate-char-gaming',
      watching_tv: 'animate-char-tv',
      worried: 'animate-char-worried',
      angry: 'animate-char-angry',
      prank: 'animate-char-prank',
      knocking_door: 'animate-char-knock',
    };
    animClass += ' ' + (POR_ACCION[currentAction] || 'animate-char-idle');
  }

  // La ESCALA va en un envoltorio y la ANIMACION en el interior. Antes iban en
  // el mismo div: las animaciones (bounce, shake, wiggle...) animan `transform`
  // y PISABAN el `scale()` del estilo, asi que el personaje cambiaba de tamano de
  // golpe al empezar o acabar de andar, bailar o temblar.
  return (
    <div
      data-resident-id={resident.id}
      className="relative inline-flex select-none"
      style={{
        transform: `scale(${scale})`,
        transformOrigin: 'bottom center',
      }}
    >
    <div className={`relative inline-flex flex-col items-center ${animClass}`}>
      {/* AURA DE DONANTE: halo dorado proporcional a los regalos recibidos.
          Es permanente mientras el residente este dentro, asi que quien dono ve
          su aporte reflejado en su personaje mucho despues de la animacion. */}
      {giftLevel > 0 && (
        <div
          className={`absolute -inset-1 rounded-full pointer-events-none ${
            isGiftCelebrating ? 'animate-gift-aura' : ''
          }`}
          style={{
            background: `radial-gradient(circle at 50% 55%, rgba(251,191,36,${
              0.14 + giftLevel * 0.07
            }) 0%, rgba(245,158,11,${0.08 + giftLevel * 0.05}) 45%, transparent 72%)`,
            boxShadow:
              giftLevel >= 3
                ? `0 0 ${6 + giftLevel * 3}px ${giftLevel}px rgba(251,191,36,${0.18 + giftLevel * 0.06})`
                : undefined,
            zIndex: -1,
          }}
          title={`${giftCount} regalo${giftCount === 1 ? '' : 's'} recibido${giftCount === 1 ? '' : 's'}`}
        />
      )}

      {/* Corona de donante: a partir de 3 regalos, para que se note quien aporta. */}
      {giftLevel >= 3 && (
        <div className="absolute -top-3.5 z-40 pointer-events-none text-[11px] animate-bounce">
          {giftLevel >= 5 ? '💎' : '⭐'}
        </div>
      )}

      {/* SUPERIOR LAYER: Action Floating Emotes & Time Warning (z-50, never cropped) */}
      <div className="absolute -top-8 z-50 flex flex-col items-center pointer-events-none w-max">
        {/* Superpoderes ganados por likes. Se dibujan siempre (tambien si esta
            estresado): son un logro del usuario y deben verse. */}
        {resident.superpowers && resident.superpowers.length > 0 && (
          <div className="flex items-center gap-0.5 mb-0.5">
            {resident.superpowers.map((id) => {
              const def = SUPERPOWERS.find((p) => p.id === id);
              if (!def) return null;
              return (
                <span
                  key={id}
                  title={`${def.name}: ${def.description}`}
                  className={`text-[10px] leading-none drop-shadow-[0_0_3px_rgba(0,0,0,0.9)] ${
                    id === 'habitacion_doble' ? 'animate-bounce' : 'animate-pulse'
                  }`}
                >
                  {def.icon}
                </span>
              );
            })}
          </div>
        )}

        {/* Impacto de poder: aviso sobre el receptor mientras tiembla. */}
        {isPowerHit && (
          <div className="flex items-center gap-1 bg-purple-700 text-white font-black text-[8px] px-1.5 py-0.5 rounded-full shadow-xl border border-purple-300 animate-bounce mb-0.5">
            <span>⚡</span>
            <span>¡PODER RECIBIDO!</span>
            <span>💥</span>
          </div>
        )}

        {/* Urgent Time Running Out Stress Badge */}
        {isCritical ? (
          <div className="flex items-center gap-1 bg-red-600 text-white font-black text-[8px] px-1.5 py-0.5 rounded-full shadow-xl border border-white animate-bounce">
            <span className="animate-spin">⏱️</span>
            <span>¡DESALOJO INMINENTE!</span>
            <span>💦</span>
          </div>
        ) : isExpiring ? (
          <div className="flex items-center gap-1 bg-amber-500 text-slate-950 font-black text-[8px] px-1.5 py-0.5 rounded-full shadow-lg border border-amber-200 animate-pulse">
            <span>⏳</span>
            <span>¡Tiempo terminando!</span>
            <span>😰</span>
          </div>
        ) : null}

        {/* Action-Specific Emotes */}
        {!isStressed && (
          <div className="flex items-center gap-1 text-xs">
            {vipLevel > 0 && <span className="animate-bounce">👑</span>}
            {/* Los emoticonos suben flotando uno tras otro (desfasados), en vez
                de botar o parpadear todos a la vez. */}
            {currentAction === 'dancing' && <Emotes items={['🎵', '🎶', '✨']} />}
            {currentAction === 'celebrating' && <Emotes items={['🎉', '✨', '🥳']} rapido />}
            {currentAction === 'gaming' && <Emotes items={['🎮', '🔥']} />}
            {currentAction === 'sleeping' && (
              <span className="relative flex items-end text-indigo-300 font-black text-[9px] h-3 w-6">
                {['z', 'z', 'Z'].map((z, i) => (
                  <span
                    key={i}
                    className="absolute bottom-0 animate-emote-zzz"
                    style={{ left: `${i * 5}px`, animationDelay: `${i * 0.8}s`, fontSize: `${7 + i * 2}px` }}
                  >
                    {z}
                  </span>
                ))}
              </span>
            )}
            {currentAction === 'watching_tv' && <Emotes items={['🍿', '📺']} />}
          </div>
        )}
      </div>

      {/* Globo de dialogo (personajes sueltos en pasillo/planta baja).
          Estaba en -top-14, que lo sacaba del contenedor del personaje y lo
          recortaba. Ahora se dibuja en -top-10 para que quede completamente
          por encima del personaje sin ser recortado por los bordes del edificio. */}
      {speechBubble && (
        <div className="absolute inset-x-0 -top-10 z-50 flex justify-center pointer-events-none px-1">
          <div className="relative bg-white text-slate-950 px-1.5 py-1 rounded-md border-2 border-slate-900 shadow-xl text-[9px] font-black max-w-[120px] text-center leading-tight break-words whitespace-normal animate-in zoom-in-95 duration-200">
            <span className="text-amber-500 mr-0.5">💬</span>
            {speechBubble.text}
            <div className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[4px] border-t-slate-900" />
            <div className="absolute left-1/2 -bottom-0.5 -translate-x-1/2 w-0 h-0 border-l-[2px] border-l-transparent border-r-[2px] border-r-transparent border-t-[3px] border-t-white" />
          </div>
        </div>
      )}

      {/* 2D Chibi Character SVG.
          El volteo va AQUI y no en un contenedor exterior: antes la habitacion
          volteaba el personaje entero con scaleX(-1) y el nombre, las insignias
          y el globo de dialogo se leian en espejo. El giro dura 180 ms para que
          se vea darse la vuelta en vez de saltar. */}
      <div
        className="relative w-10 h-14 flex items-center justify-center transition-transform duration-200 ease-out"
        style={{ transform: flip ? 'scaleX(-1)' : undefined }}
      >
        <svg
          viewBox="0 0 40 56"
          className="w-full h-full drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]"
        >
          {/* Shadow beneath character */}
          <ellipse cx="20" cy="52" rx="14" ry="3.5" fill="rgba(0,0,0,0.35)" />

          {/* Legs & Shoes with walk/dance steps */}
          <rect
            x="14"
            y={currentAction === 'walking' ? '43' : '44'}
            width="4"
            height="8"
            rx="2"
            fill="#2C3E50"
            transform={currentAction === 'walking' ? 'rotate(-6 16 44)' : undefined}
          />
          <rect
            x="22"
            y={currentAction === 'walking' ? '45' : '44'}
            width="4"
            height="8"
            rx="2"
            fill="#2C3E50"
            transform={currentAction === 'walking' ? 'rotate(6 24 44)' : undefined}
          />
          <ellipse cx="15.5" cy="51" rx="3" ry="1.5" fill="#1A252F" />
          <ellipse cx="24.5" cy="51" rx="3" ry="1.5" fill="#1A252F" />

          {/* Body / Outfit */}
          <rect
            x="11"
            y="26"
            width="18"
            height="20"
            rx="5"
            fill={isStressed ? '#7F1D1D' : avatar.outfitColor}
            className="transition-colors duration-300"
          />

          {/* Outfit details (gamer stripes, tie, or party glitter) */}
          {avatar.outfitStyle === 'suit' && (
            <>
              <polygon points="20,28 18,36 20,40 22,36" fill="#E74C3C" />
              <polygon points="17,26 20,30 23,26" fill="#FFFFFF" />
            </>
          )}
          {avatar.outfitStyle === 'gamer' && (
            <rect x="13" y="32" width="14" height="3" rx="1" fill="#00FFCC" opacity="0.8" />
          )}
          {avatar.outfitStyle === 'party' && (
            <circle cx="20" cy="34" r="3" fill="#F1C40F" />
          )}

          {/* Expressive Arms reacting to action & stress */}
          {isStressed ? (
            // Arms clutching head in panic!
            <>
              <rect
                x="6"
                y="15"
                width="4"
                height="13"
                rx="2"
                fill={avatar.skinColor}
                transform="rotate(-55 8 22)"
              />
              <rect
                x="30"
                y="15"
                width="4"
                height="13"
                rx="2"
                fill={avatar.skinColor}
                transform="rotate(55 32 22)"
              />
            </>
          ) : currentAction === 'celebrating' ? (
            // Arms raised high in victory!
            <>
              <rect
                x="6"
                y="16"
                width="4"
                height="13"
                rx="2"
                fill={avatar.skinColor}
                transform="rotate(-35 8 22)"
              />
              <rect
                x="30"
                y="16"
                width="4"
                height="13"
                rx="2"
                fill={avatar.skinColor}
                transform="rotate(35 32 22)"
              />
            </>
          ) : currentAction === 'dancing' ? (
            // Arms swinging to music rhythm
            <>
              <rect
                x="6"
                y="24"
                width="4"
                height="12"
                rx="2"
                fill={avatar.skinColor}
                transform="rotate(30 8 28)"
              />
              <rect
                x="30"
                y="24"
                width="4"
                height="12"
                rx="2"
                fill={avatar.skinColor}
                transform="rotate(-30 32 28)"
              />
            </>
          ) : (
            // Regular arms
            <>
              <rect x="7" y="27" width="4" height="11" rx="2" fill={avatar.skinColor} />
              <rect x="29" y="27" width="4" height="11" rx="2" fill={avatar.skinColor} />
            </>
          )}

          {/* Chibi Head */}
          <circle cx="20" cy="17" r="12" fill={avatar.skinColor} />

          {/* Blush cheeks */}
          <circle cx="12" cy="20" r="2" fill={isStressed ? '#991B1B' : '#FF7675'} opacity="0.6" />
          <circle cx="28" cy="20" r="2" fill={isStressed ? '#991B1B' : '#FF7675'} opacity="0.6" />

          {/* Panic / Stress Sweat Droplet on forehead */}
          {isStressed && (
            <path
              d="M 28 8 C 30 12 31 14 29 15 C 27 16 26 14 28 8 Z"
              fill="#38BDF8"
              className="animate-pulse"
            />
          )}

          {/* Eyes & Mouth: Highly Expressive per Action and Stress */}
          {currentAction === 'sleeping' ? (
            <>
              {/* Peaceful sleeping curved eyes */}
              <path d="M 13 18 Q 16 21 19 18" stroke="#2D3436" strokeWidth="1.5" fill="none" />
              <path d="M 21 18 Q 24 21 27 18" stroke="#2D3436" strokeWidth="1.5" fill="none" />
              <ellipse cx="20" cy="21" rx="1" ry="0.8" fill="#2D3436" />
            </>
          ) : isStressed ? (
            <>
              {/* Panicked wide trembling eyes */}
              <circle cx="15" cy="17" r="2.8" fill="#FFFFFF" />
              <circle cx="25" cy="17" r="2.8" fill="#FFFFFF" />
              <circle cx="15" cy="17" r="1.3" fill="#DC2626" className="animate-ping" />
              <circle cx="25" cy="17" r="1.3" fill="#DC2626" className="animate-ping" />
              {/* Trembling wavy mouth */}
              <path d="M 15 22 Q 17.5 20 20 22 Q 22.5 24 25 22" stroke="#2D3436" strokeWidth="1.4" fill="none" />
            </>
          ) : currentAction === 'celebrating' || currentAction === 'dancing' ? (
            <>
              {/* Ecstatic Happy Arched Eyes */}
              <path d="M 13 18 Q 16 14 19 18" stroke="#2D3436" strokeWidth="1.8" fill="none" />
              <path d="M 21 18 Q 24 14 27 18" stroke="#2D3436" strokeWidth="1.8" fill="none" />
              {/* Open happy smile */}
              <path d="M 16 20 Q 20 25 24 20 Z" fill="#E74C3C" />
            </>
          ) : currentAction === 'gaming' ? (
            <>
              {/* Intense focused gamer brow & eyes */}
              <path d="M 13 14 L 18 16" stroke="#2D3436" strokeWidth="1.5" />
              <path d="M 27 14 L 22 16" stroke="#2D3436" strokeWidth="1.5" />
              <circle cx="15" cy="17" r="2.2" fill="#2D3436" />
              <circle cx="25" cy="17" r="2.2" fill="#2D3436" />
              <line x1="17" y1="21" x2="23" y2="21" stroke="#2D3436" strokeWidth="1.2" />
            </>
          ) : (
            <>
              {/* Big Expressive Chibi Eyes */}
              <circle cx="15" cy="17" r="2.8" fill="#2D3436" />
              <circle cx="25" cy="17" r="2.8" fill="#2D3436" />
              {/* Eye sparkle highlights */}
              <circle cx="16" cy="16" r="1" fill="#FFFFFF" />
              <circle cx="26" cy="16" r="1" fill="#FFFFFF" />
              {/* Smile */}
              <path d="M 17 21 Q 20 24 23 21" stroke="#2D3436" strokeWidth="1.2" fill="none" />
            </>
          )}

          {/* Hair Styles */}
          {avatar.hairStyle === 'spiky' && (
            <path
              d="M 8 16 Q 10 5 15 7 Q 20 3 25 7 Q 30 5 32 16 Q 30 7 20 6 Q 10 7 8 16"
              fill={avatar.hairColor}
            />
          )}
          {avatar.hairStyle === 'curly' && (
            <path
              d="M 8 18 Q 6 8 14 7 Q 20 4 26 7 Q 34 8 32 18 Q 30 11 20 9 Q 10 11 8 18"
              fill={avatar.hairColor}
            />
          )}
          {avatar.hairStyle === 'sleek' && (
            <path
              d="M 9 17 Q 10 7 20 6 Q 30 7 31 17 Q 30 9 20 8 Q 10 9 9 17"
              fill={avatar.hairColor}
            />
          )}
          {avatar.hairStyle === 'bob' && (
            <path
              d="M 7 19 Q 8 6 20 6 Q 32 6 33 19 Q 31 12 20 10 Q 9 12 7 19"
              fill={avatar.hairColor}
            />
          )}
          {avatar.hairStyle === 'ponytail' && (
            <>
              <path
                d="M 9 16 Q 11 6 20 6 Q 29 6 31 16 Q 29 8 20 8 Q 11 8 9 16"
                fill={avatar.hairColor}
              />
              <circle cx="31" cy="12" r="3.5" fill={avatar.hairColor} />
            </>
          )}
          {avatar.hairStyle === 'cap' && (
            <>
              <path d="M 8 15 Q 11 8 20 8 Q 29 8 32 15 Z" fill="#E74C3C" />
              <rect x="18" y="14" width="16" height="3" rx="1.5" fill="#C0392B" />
            </>
          )}
          {avatar.hairStyle === 'headphones' && (
            <>
              <path d="M 8 17 A 12 12 0 0 1 32 17" stroke="#10B981" strokeWidth="2.5" fill="none" />
              <rect x="7" y="14" width="3" height="6" rx="1" fill="#10B981" />
              <rect x="30" y="14" width="3" height="6" rx="1" fill="#10B981" />
            </>
          )}
        </svg>
      </div>

      {/* Username Tag Badge */}
      {showName && (
        <div className="mt-0.5 bg-black/85 backdrop-blur-xs text-amber-200 font-black text-[7.5px] px-1.5 py-0.2 rounded-full border border-amber-400/40 shadow-xs max-w-[65px] truncate text-center tracking-tight leading-none">
          {displayName}
        </div>
      )}
    </div>
    </div>
  );
};

/** Memoizado: solo se repinta si cambian sus props (el estado es inmutable). */
export const CharacterRenderer = React.memo(CharacterRendererBase);

/**
 * Emoticonos de accion que suben flotando, uno tras otro.
 * Solo CSS (retardos por elemento): ningun temporizador de JS por personaje.
 */
const Emotes: React.FC<{ items: string[]; rapido?: boolean }> = ({ items, rapido }) => {
  const dur = rapido ? 1.1 : 1.8;
  return (
    <span className="relative flex items-end h-4" style={{ width: `${items.length * 12}px` }}>
      {items.map((e, i) => (
        <span
          key={i}
          className="absolute bottom-0 animate-emote-float"
          style={
            {
              left: `${i * 11}px`,
              animationDuration: `${dur}s`,
              animationDelay: `${(i * dur) / items.length}s`,
              '--emote-dx': `${i % 2 === 0 ? -3 : 3}px`,
            } as React.CSSProperties
          }
        >
          {e}
        </span>
      ))}
    </span>
  );
};
