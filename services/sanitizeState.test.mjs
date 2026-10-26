import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// El proyecto es TS y no tiene loader: se transpila el modulo a JS sobre la
// marcha con el propio tsc, sin anadir dependencias.
rmSync(`${ROOT}/.tmp-test`, { recursive: true, force: true });
execFileSync('npx', ['tsc', 'services/sanitizeState.ts',
  '--module', 'esnext', '--target', 'es2022', '--skipLibCheck',
  '--outDir', '.tmp-test'], { cwd: ROOT, stdio: 'inherit' });

const mod = await import(`../.tmp-test/sanitizeState.js`);
const { num, sanitizeRestoredState } = mod;

test('num: acepta numeros finitos', () => {
  assert.equal(num('42', 0), 42);
  assert.equal(num(3.5, 0), 3.5);
});

test('num: cae al defecto con basura', () => {
  assert.equal(num(undefined, 80), 80);
  assert.equal(num('abc', 0), 0);
  assert.equal(num(NaN, 7), 7);
  assert.equal(num({}, 5), 5);
});

// TRAMPA REAL: Number(null) es 0 y 0 es finito, asi que num(null, d) NO cae al
// defecto — devuelve 0. El codigo original tenia exactamente esta semantica.
test('num: null se convierte en 0, no en el defecto', () => {
  assert.equal(num(null, 100), 0);
});

test('saneador: estado minimo no revienta', () => {
  const out = sanitizeRestoredState({});
  assert.deepEqual(out.floors, []);
  assert.deepEqual(out.residents, {});
  assert.deepEqual(out.rooms, {});
  assert.deepEqual(out.powerCasts, []);
  assert.equal(out.globalEvent.type, 'NONE');
});

test('saneador: descarta residentes sin username', () => {
  const out = sanitizeRestoredState({ residents: { r1: { displayName: '' } } });
  assert.deepEqual(out.residents, {});
});

test('saneador: libera habitacion cuyo ocupante no existe', () => {
  const out = sanitizeRestoredState({
    residents: {},
    rooms: { a: { id: 'a', occupantId: 'fantasma', status: 'OCUPADA' } },
  });
  assert.equal(out.rooms.a.status, 'VACIA');
  assert.equal(out.rooms.a.occupantId, null);
});

// OJO: el nombre de este test era una mentira. El codigo original hace
// Number(null) -> 0 (finito), y null -> 0 en la restauracion. Se conserva la
// semantica REAL, no la que uno esperaria del tipo `null | number`.
test('saneador: stayRemainingSec null se restaura como 0 (semantica original)', () => {
  const out = sanitizeRestoredState({
    residents: { r1: { username: 'ana', displayName: '@ana', stayRemainingSec: null } },
  });
  assert.equal(out.residents.r1.stayRemainingSec, 0);
});

test('saneador: stayRemainingSec ausente queda null (sin reloj)', () => {
  const out = sanitizeRestoredState({
    residents: { r1: { username: 'ana', displayName: '@ana' } },
  });
  // undefined -> Number(undefined) = NaN -> no finito -> null.
  assert.equal(out.residents.r1.stayRemainingSec, null);
});

test('saneador: conserva defaults numericos', () => {
  const out = sanitizeRestoredState({
    residents: { r1: { username: 'ana', displayName: '@ana' } },
  });
  assert.equal(out.residents.r1.energy, 80);
  assert.equal(out.residents.r1.stability, 100);
  assert.equal(out.residents.r1.coordX, 50);
  assert.equal(out.residents.r1.roomSpan, 1);
  assert.equal(out.residents.r1.likes, 0);
});

test('saneador: respeta valores numericos reales', () => {
  const out = sanitizeRestoredState({
    residents: { r1: { username: 'ana', displayName: '@ana', energy: 33, likes: 500, stayRemainingSec: 90 } },
  });
  assert.equal(out.residents.r1.energy, 33);
  assert.equal(out.residents.r1.likes, 500);
  assert.equal(out.residents.r1.stayRemainingSec, 90);
});

test('saneador: un piso sin habitaciones validas se descarta', () => {
  const out = sanitizeRestoredState({
    floors: [{ floorNumber: 1, name: 'Piso 1', rooms: ['noexiste'] }],
    rooms: {},
  });
  assert.equal(out.floors.length, 0);
});
