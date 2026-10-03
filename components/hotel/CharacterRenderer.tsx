'use client';

import React from 'react';
import { Resident } from '../../types/hotel';

interface CharacterRendererProps {
  resident: Resident;
  scale?: number;
  showName?: boolean;
}

export const CharacterRenderer: React.FC<CharacterRendererProps> = ({
  resident,
  scale = 1,
  showName = true,
}) => {
  const { avatar, personality, currentAction, stability, vipLevel, speechBubble } = resident;

  // Stability warning: time running out / stress detection
  const isCritical = stability <= 15;
  const isExpiring = stability <= 35 && !isCritical;
  const isLow = stability <= 50 && !isExpiring && !isCritical;
  const isStressed = isCritical || isExpiring || currentAction === 'worried';

  // Animation classes based on action and stress
  let animClass = 'transition-transform duration-300';
  if (isCritical) {
    animClass += ' animate-[shake_0.25s_ease-in-out_infinite]';
  } else if (isExpiring) {
    animClass += ' animate-[wiggle_0.4s_ease-in-out_infinite]';
  } else if (currentAction === 'dancing') {
    animClass += ' animate-bounce';
  } else if (currentAction === 'celebrating') {
    animClass += ' animate-[bounce_0.6s_infinite]';
  } else if (currentAction === 'walking') {
    animClass += ' animate-[wiggle_0.4s_ease-in-out_infinite]';
  } else if (currentAction === 'gaming') {
    animClass += ' animate-pulse';
  }

  return (
    <div
      className={`relative inline-flex flex-col items-center select-none ${animClass}`}
      style={{
        transform: `scale(${scale})`,
        transformOrigin: 'bottom center',
      }}
    >
      {/* SUPERIOR LAYER: Action Floating Emotes & Time Warning (z-50, never cropped) */}
      <div className="absolute -top-8 z-50 flex flex-col items-center pointer-events-none w-max">
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
            {currentAction === 'dancing' && (
              <span className="flex items-center gap-0.5 animate-bounce">
                <span className="text-pink-400">🎵</span>
                <span className="text-amber-400">🎶</span>
                <span className="text-cyan-400">✨</span>
              </span>
            )}
            {currentAction === 'celebrating' && (
              <span className="flex items-center gap-0.5 animate-ping">
                <span>🎉</span>
                <span>✨</span>
                <span>🥳</span>
              </span>
            )}
            {currentAction === 'gaming' && (
              <span className="flex items-center gap-0.5 animate-bounce">
                <span>🎮</span>
                <span className="text-red-500">🔥</span>
              </span>
            )}
            {currentAction === 'sleeping' && (
              <span className="text-indigo-300 font-bold text-[9px] animate-pulse">
                💤 Zzz...
              </span>
            )}
            {currentAction === 'watching_tv' && (
              <span className="flex items-center gap-0.5 animate-pulse">
                <span>🍿</span>
                <span>📺</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Speech Bubble (Comic dialogue, elevated z-50) */}
      {speechBubble && (
        <div className="absolute -top-14 z-50 animate-in fade-in zoom-in-95 duration-200 pointer-events-none w-max max-w-[130px]">
          <div className="relative bg-white text-slate-950 px-2 py-0.5 rounded-lg shadow-2xl border-2 border-slate-900 text-[9px] font-black text-center leading-tight whitespace-normal break-words">
            <span className="text-amber-500 mr-0.5">💬</span>{speechBubble.text}
            {/* Bubble Tail */}
            <div className="absolute left-1/2 -bottom-1.5 -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] border-t-slate-900" />
            <div className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[4px] border-t-white" />
          </div>
        </div>
      )}

      {/* 2D Chibi Character SVG */}
      <div className="relative w-10 h-14 flex items-center justify-center">
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
          {resident.displayName}
        </div>
      )}
    </div>
  );
};
