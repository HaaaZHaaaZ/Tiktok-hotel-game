'use client';

import React from 'react';
import { Floor, Room, Resident, TimeOfDay, GlobalEventType, DemolitionState } from '../../types/hotel';
import { RoomRenderer } from './RoomRenderer';
import { ElevatorRenderer } from './ElevatorRenderer';
import { CharacterRenderer } from './CharacterRenderer';
import { floorPropsEqual, type FloorPropsLike } from '../../services/floorEquality';
import { FloorConstructionOverlay, CONSTRUCCION_MS } from './FloorConstructionOverlay';
import { useRerenderAt } from './useRerenderAt';

interface FloorRendererProps {
  floor: Floor;
  rooms: Record<string, Room>;
  residents: Record<string, Resident>;
  timeOfDay: TimeOfDay;
  globalEvent: GlobalEventType;
  focusedRoomNumber?: number;
  isElevatorOpen?: boolean;
  demolitionState?: DemolitionState;
}

const FloorRendererBase: React.FC<FloorRendererProps> = ({
  floor,
  rooms,
  residents,
  timeOfDay,
  globalEvent,
  focusedRoomNumber,
  isElevatorOpen = false,
  demolitionState,
}) => {
  // Exactly 4 rooms on this floor, sorted by number (e.g. 101, 102, 103, 104)
  // `floor.rooms` puede faltar en un estado restaurado viejo: sin el fallback,
  // el .map() tumba la app entera.
  const floorRooms = (Array.isArray(floor.rooms) ? floor.rooms : [])
    .map((id) => rooms[id])
    .filter(Boolean)
    .sort((a, b) => a.number - b.number);

  // Corridor residents (walking or emerging from elevator)
  //
  // OJO con `isEntering`: durante el ascensor el residente ya va de camino a su
  // cuarto, y dibujarlo en el pasillo era lo que dejaba personajes "viviendo" en
  // el pasillo cuando el ultimo paso del ingreso no llegaba a ejecutarse.
  // Solo se considera pasillo si esta REALMENTE en el pasillo: en `elevator` o
  // en `reception` esta en otro sitio y ahi se dibuja.
  const corridorResidents = Object.values(residents).filter(
    (res) =>
      res.floorNumber === floor.floorNumber &&
      res.location === 'corridor'
  );

  const isThisFloorDemolishing =
    demolitionState?.isDemolishing && demolitionState.demolishingFloorNumber === floor.floorNumber;

  const isCrackingAndFlickering = isThisFloorDemolishing && demolitionState?.phase === 'cracks_and_flicker';
  const isExplodingBricks = isThisFloorDemolishing && demolitionState?.phase === 'exploding_bricks';
  const isCollapsingHeight =
    isThisFloorDemolishing &&
    (demolitionState?.phase === 'exploding_bricks' || demolitionState?.phase === 'upper_floors_falling');

  // Piso recien construido: animacion de obra durante CONSTRUCCION_MS.
  const builtAt = typeof floor.builtAt === 'number' ? floor.builtAt : 0;
  useRerenderAt(builtAt ? builtAt + CONSTRUCCION_MS : null);
  const enConstruccion = !!builtAt && Date.now() - builtAt < CONSTRUCCION_MS;

  const isThisFloorFalling =
    demolitionState?.isDemolishing &&
    demolitionState.affectedUpperFloors.includes(floor.floorNumber) &&
    demolitionState.phase === 'upper_floors_falling';

  // Escombros que salen volando: se generan una vez (posiciones fijas por
  // indice) para que no cambien en cada render.
  const escombros = ESCOMBROS;

  return (
    // Envoltorio EXTERIOR sin recorte. El piso que se derrumba (interior) tiene
    // `overflow-hidden` y `contain: paint`, asi que cualquier efecto dibujado
    // DENTRO quedaba recortado mientras el piso se encogia: la explosion apenas
    // se veia. Los efectos grandes (explosion, polvo, construccion) van aqui.
    <div
      className={`relative w-full ${isThisFloorFalling ? 'animate-floor-slam' : ''} ${
        enConstruccion ? 'animate-floor-build z-30' : ''
      }`}
    >
    <div
      // `transition-[max-height,opacity,transform]` en vez de `transition-all`:
      // `all` obligaba al navegador a vigilar TODAS las propiedades del subarbol
      // del piso (que tiene ~30 nodos) en cada frame de la animacion. Con la
      // lista explicita solo se siguen las tres que de verdad cambian, que es lo
      // que se notaba como tirones al derribar un piso.
      className={`relative w-full border-x-4 border-t-2 border-b-2 border-slate-700 bg-stone-900 shadow-2xl transition-[max-height,opacity,transform] duration-1000 ease-in-out ${
        isCollapsingHeight
          ? 'max-h-0 py-0 opacity-0 border-y-0 overflow-hidden scale-95'
          : 'max-h-[350px] p-2'
      } ${
        isCrackingAndFlickering ? 'animate-floor-tremor shadow-[0_0_30px_rgba(239,68,68,0.9)]' : ''
      }`}
      /* `contain: paint` aisla el repintado del piso: cuando su altura cambia,
         el navegador no necesita recalcular los pisos vecinos. `will-change`
         avisa de que la altura va a animarse, para que suba a su propia capa
         antes de empezar en vez de improvisarlo en el primer frame (que es lo
         que producia el tiron inicial). */
      style={{
        contain: 'paint',
        willChange: isCollapsingHeight ? 'max-height, opacity, transform' : undefined,
      }}
    >
      {/* 1. Structural Demolition: Cracks & Electrical Outages */}
      {isCrackingAndFlickering && (
        <div className="absolute inset-0 z-50 pointer-events-none overflow-hidden rounded">
          {/* Electrical power outage strobe light flashes */}
          <div className="absolute inset-0 bg-yellow-400/35 mix-blend-color-dodge animate-flicker" />
          {/* Apagon progresivo: la luz se va yendo mientras crecen las grietas. */}
          <div className="absolute inset-0 bg-black animate-blackout" />

          {/* Grietas que SE ABREN: cada una se dibuja de punta a punta
              (pathLength=1 + stroke-dashoffset), escalonadas. Antes eran
              lineas fijas que aparecian de golpe. */}
          <svg
            viewBox="0 0 480 170"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full stroke-red-500 fill-none drop-shadow-[0_0_6px_#FF0000]"
          >
            {[
              '20,0 60,35 50,65 90,95 80,130 130,170',
              '180,0 160,40 190,75 170,110 210,160',
              '320,0 300,45 330,80 310,120 350,170',
              '450,15 410,50 430,90 380,125 400,170',
              '0,90 80,105 160,85 240,100 360,90 480,100',
            ].map((pts, i) => (
              <polyline
                key={i}
                points={pts}
                pathLength={1}
                strokeWidth={2.5}
                vectorEffect="non-scaling-stroke"
                className="animate-crack-draw"
                style={{ animationDelay: `${i * 0.28}s` }}
              />
            ))}
          </svg>

          {/* Chispas en los cables cortados */}
          <div className="absolute top-2 left-8 text-xl animate-spark">⚡</div>
          <div className="absolute top-1/2 left-1/3 text-xl animate-spark" style={{ animationDelay: '0.45s' }}>⚡</div>
          <div className="absolute top-3 right-14 text-lg animate-spark" style={{ animationDelay: '0.8s' }}>⚡</div>

          {/* Se desprenden trozos del techo */}
          {[12, 30, 47, 66, 84].map((x, i) => (
            <div
              key={x}
              className="absolute top-0 text-[9px] animate-crumb"
              style={{ left: `${x}%`, animationDelay: `${0.3 + i * 0.32}s` }}
            >
              🪨
            </div>
          ))}

          {/* Cartel de aviso: entra de golpe y se queda. Ya no oscurece todo el
              piso con un velo + blur, que tapaba las grietas. */}
          <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center">
            <div className="bg-red-600 text-white font-black text-xs px-3 py-1.5 rounded-lg border-2 border-yellow-300 shadow-2xl animate-alert-pop flex items-center gap-1.5">
              <span>🚨</span>
              <span>¡FALLO ELÉCTRICO & DEMOLICIÓN EN CURSO!</span>
              <span>🚨</span>
            </div>
            <div className="text-[9px] text-amber-300 font-mono font-bold mt-1 bg-black/80 px-2 py-0.5 rounded border border-amber-500/50">
              Desmantelando Piso {floor.floorNumber}...
            </div>
          </div>
        </div>
      )}

      {/* Floor Top Bar: Floor Indicator & Central Elevator/Corridor Strip */}
      <div className="flex items-center justify-between px-2 py-1 mb-1.5 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 rounded border border-slate-600 shadow-md">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_#F59E0B]" />
          <span className="text-[11px] font-black tracking-wider text-amber-300">
            {floor.name.toUpperCase()}
          </span>
          <span className="text-[9px] text-slate-300 font-medium">
            (4 Habitaciones en Fila)
          </span>
        </div>

        {/* Mini Floor Elevator */}
        <div className="flex items-center gap-1 bg-black/60 px-2 py-0.5 rounded border border-slate-700">
          <span className="text-[8px] text-amber-400 font-black animate-pulse">▲</span>
          <span className="text-[9px] font-mono font-bold text-amber-300">
            ASCENSOR P{floor.floorNumber}
          </span>
          <div className={`w-1.5 h-1.5 rounded-full ${isElevatorOpen ? 'bg-emerald-400 shadow-[0_0_4px_#10B981]' : 'bg-amber-500'}`} />
        </div>

        <div className="text-[9px] text-slate-400 font-mono font-bold">
          HAB. {floor.floorNumber}01 - {floor.floorNumber}04
        </div>
      </div>

      {/* Hallway Walkers Strip (When resident is walking down corridor) */}
      {corridorResidents.length > 0 && (
        <div className="relative w-full h-8 bg-amber-950/80 rounded border border-amber-600/50 mb-1.5 px-2 flex items-center overflow-hidden">
          <div className="text-[8px] text-amber-400 font-black mr-2 uppercase">PASILLO:</div>
          {corridorResidents.map((res) => (
            <div
              key={res.id}
              className="flex items-center gap-1 animate-in fade-in duration-300"
            >
              <CharacterRenderer resident={res} scale={0.75} showName={true} />
              <span className="text-[8px] font-bold text-slate-200">➔ Dirigiéndose a Hab. {res.roomId ? res.roomId.replace('room_', '') : ''}</span>
            </div>
          ))}
        </div>
      )}

      {/* SINGLE ROW OF 4 ROOMS.
          La fila usa columnas reales para que una habitacion expandida (el
          superpoder de 500) ocupe varias de una vez, en lugar de dibujarse como
          recuadros sueltos. El personaje vive en SU bloque, asi que no se
          duplica. */}
      <div
        className="grid gap-1.5 w-full"
        style={{ gridTemplateColumns: `repeat(4, minmax(0, 1fr))` }}
      >
        {floorRooms.map((room) => {
          const occupant = room.occupantId ? residents[room.occupantId] : undefined;
          // Character must ONLY be rendered inside room if their current location is physically 'room'
          // La habitacion PRINCIPAL de un residente expandido se dibuja como un
          // solo bloque ancho; las absorbidas quedan como parte de el y no se
          // renderizan por separado.
          //
          // La marca vive en la HABITACION (`absorbedBy`), no en el residente:
          // cuando se desaloja al vecino, su `occupantId` se limpia, y mirando
          // solo al residente la habitacion reaparecia como recuadro suelto en
          // una fila nueva dentro del piso (habia 5+ habitaciones por piso).
          const esAbsorbida =
            !!room.absorbedBy || (!!occupant && !!occupant.expandedRoomIds?.includes(room.id));
          if (esAbsorbida) return null;

          const span = occupant?.roomSpan && occupant.roomSpan > 1 ? Math.min(4, occupant.roomSpan) : 1;
          const roomResident = occupant && occupant.location === 'room' ? occupant : undefined;

          return (
            <div key={room.id} style={{ gridColumn: `span ${span} / span ${span}` }}>
              <RoomRenderer
                room={room}
                resident={roomResident}
                timeOfDay={timeOfDay}
                globalEvent={globalEvent}
                isFocused={focusedRoomNumber === room.number}
                isFalling={isThisFloorFalling}
                span={span}
              />
            </div>
          );
        })}
      </div>
    </div>

      {/* EXPLOSION: fuera del piso que se encoge, para que se vea entera.
          Destello -> onda expansiva -> bola de fuego -> escombros en parabola
          -> nube de polvo. Todo transform/opacity. */}
      {isExplodingBricks && (
        <div className="absolute inset-0 z-50 pointer-events-none overflow-visible flex items-center justify-center">
          <div className="absolute inset-0 bg-white animate-blast-flash rounded" />
          <div className="absolute w-24 h-24 rounded-full border-4 border-amber-200 animate-shockwave" />
          <div
            className="absolute w-40 h-40 rounded-full animate-fireball"
            style={{ background: 'radial-gradient(circle, #FEF08A 0%, #F97316 40%, #DC2626 65%, transparent 72%)' }}
          />
          <div className="absolute text-4xl animate-blast-emoji">💥</div>
          {escombros.map((e, i) => (
            <div
              key={i}
              className="absolute animate-debris"
              style={
                {
                  fontSize: `${e.size}px`,
                  animationDelay: `${e.delay}s`,
                  '--dx': `${e.dx}px`,
                  '--up': `${e.up}px`,
                  '--dy': `${e.dy}px`,
                  '--rot': `${e.rot}deg`,
                } as React.CSSProperties
              }
            >
              {e.emoji}
            </div>
          ))}
          {[-38, -14, 10, 34].map((x, i) => (
            <div
              key={x}
              className="absolute bottom-0 w-16 h-10 rounded-full bg-stone-400/70 animate-dust-puff"
              style={{ left: `calc(50% + ${x}% - 2rem)`, animationDelay: `${0.25 + i * 0.07}s` }}
            />
          ))}
        </div>
      )}

      {/* Golpe de los pisos superiores al caer sobre el hueco: polvo en la base. */}
      {isThisFloorFalling && (
        <div className="absolute inset-x-0 -bottom-2 h-6 z-40 pointer-events-none flex justify-around">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-10 h-6 rounded-full bg-stone-300/60 animate-dust-puff"
              style={{ animationDelay: `${0.62 + (i % 2) * 0.06}s` }}
            />
          ))}
        </div>
      )}

      {/* CONSTRUCCION de un piso nuevo (andamios, grua, cinta...). */}
      {enConstruccion && <FloorConstructionOverlay floorNumber={floor.floorNumber} />}
    </div>
  );
};

/** Escombros de la explosion: emoji, tamano y trayectoria (parabola). */
const ESCOMBROS = [
  { emoji: '🪨', dx: -150, up: 70, dy: 120, rot: -260, size: 22, delay: 0.05 },
  { emoji: '⚫', dx: -95, up: 95, dy: 150, rot: 320, size: 18, delay: 0.1 },
  { emoji: '🌑', dx: -40, up: 110, dy: 170, rot: -200, size: 20, delay: 0 },
  { emoji: '🪨', dx: 30, up: 105, dy: 160, rot: 280, size: 16, delay: 0.08 },
  { emoji: '💩', dx: 90, up: 85, dy: 140, rot: -340, size: 18, delay: 0.12 },
  { emoji: '⚫', dx: 150, up: 65, dy: 125, rot: 240, size: 20, delay: 0.04 },
  { emoji: '🪨', dx: -170, up: 30, dy: 90, rot: 180, size: 14, delay: 0.15 },
  { emoji: '🌑', dx: 175, up: 35, dy: 95, rot: -180, size: 14, delay: 0.18 },
  { emoji: '🪨', dx: -60, up: 45, dy: 110, rot: 150, size: 12, delay: 0.2 },
  { emoji: '⚫', dx: 65, up: 50, dy: 115, rot: -150, size: 12, delay: 0.22 },
];

/**
 * Memoizado con un comparador propio: el piso recibe `rooms` y `residents` del
 * hotel entero, pero solo se repinta si cambia algo de SU piso (ver
 * `services/floorEquality.ts`).
 */
export const FloorRenderer = React.memo(FloorRendererBase, (a, b) =>
  floorPropsEqual(a as unknown as FloorPropsLike, b as unknown as FloorPropsLike)
);
