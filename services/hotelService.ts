import { Floor, Room } from '../types/hotel';

export function createFloorRooms(floorNumber: number): { rooms: Record<string, Room>; roomIds: string[] } {
  const rooms: Record<string, Room> = {};
  const roomIds: string[] = [];

  // Exactly 4 rooms per floor (e.g. 101, 102, 103, 104)
  for (let i = 1; i <= 4; i++) {
    const roomNum = floorNumber * 100 + i;
    const id = `room_${roomNum}`;
    rooms[id] = {
      id,
      number: roomNum,
      floorNumber,
      row: i <= 2 ? 'top' : 'bottom', // 2 on left / 2 on right or row
      colIndex: i - 1,
      status: 'VACIA',
      occupantId: null,
      level: 'NORMAL',
      decorLevel: 1,
      stability: 100,
      points: 0,
      lightOn: true,
      lastInteractionAt: Date.now(),
    };
    roomIds.push(id);
  }

  return { rooms, roomIds };
}

export function createInitialHotel() {
  const { rooms, roomIds } = createFloorRooms(1);
  const floor1: Floor = {
    id: 'floor_1',
    floorNumber: 1,
    name: 'Piso 1',
    rooms: roomIds,
    status: 'active',
    isDestroyable: false, // Floor 1 cannot be destroyed
  };

  return {
    floors: [floor1],
    rooms,
  };
}
