import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = '.tmp-test-perf';
execFileSync('npx', ['tsc', 'services/structuralShare.ts', 'services/floorEquality.ts',
  '--module', 'esnext', '--target', 'es2022', '--skipLibCheck', '--outDir', OUT],
  { cwd: ROOT, stdio: 'inherit' });

const { shareUnchanged } = await import(`../${OUT}/structuralShare.js`);
const { floorPropsEqual } = await import(`../${OUT}/floorEquality.js`);

const clone = (x) => JSON.parse(JSON.stringify(x));

const base = {
  floors: [{ id: 'f1', floorNumber: 1, rooms: ['r101', 'r102'] }, { id: 'f2', floorNumber: 2, rooms: ['r201'] }],
  rooms: { r101: { occupantId: 'a' }, r102: { occupantId: null }, r201: { occupantId: 'b' } },
  residents: {
    a: { id: 'a', floorNumber: 1, stability: 50, superpowers: ['regen'] },
    b: { id: 'b', floorNumber: 2, stability: 80, superpowers: [] },
  },
  entryQueue: [],
};

test('shareUnchanged: estado identico (JSON nuevo) -> devuelve el anterior', () => {
  assert.equal(shareUnchanged(base, clone(base)), base);
});

test('shareUnchanged: cambia un residente -> solo cambia su rama', () => {
  const n = clone(base);
  n.residents.a.stability = 49;
  const r = shareUnchanged(base, n);
  assert.notEqual(r, base);
  assert.notEqual(r.residents, base.residents);
  assert.notEqual(r.residents.a, base.residents.a);
  assert.equal(r.residents.a.superpowers, base.residents.a.superpowers);
  assert.equal(r.residents.b, base.residents.b);
  assert.equal(r.rooms, base.rooms);
  assert.equal(r.floors, base.floors);
  assert.deepEqual(r, n);
});

test('shareUnchanged: claves nuevas, borradas y arrays de distinta longitud', () => {
  const n = clone(base);
  delete n.residents.b;
  n.residents.c = { id: 'c', floorNumber: 1 };
  n.entryQueue.push('x');
  const r = shareUnchanged(base, n);
  assert.deepEqual(r, n);
  assert.equal(r.residents.a, base.residents.a);
  assert.ok(!('b' in r.residents));
});

test('shareUnchanged: undefined y null no se confunden', () => {
  assert.deepEqual(shareUnchanged({ x: undefined }, { x: null }), { x: null });
  assert.deepEqual(shareUnchanged({ x: 1 }, { y: undefined }), { y: undefined });
  assert.deepEqual(shareUnchanged([1, 2], { 0: 1, 1: 2 }), { 0: 1, 1: 2 });
});

const props = (s, floorIdx, extra = {}) => ({
  floor: s.floors[floorIdx], rooms: s.rooms, residents: s.residents,
  timeOfDay: 'day', globalEvent: 'NONE', ...extra,
});

test('floorPropsEqual: un cambio en el piso 2 no repinta el piso 1', () => {
  const n = shareUnchanged(base, (() => { const c = clone(base); c.residents.b.stability = 1; return c; })());
  assert.equal(floorPropsEqual(props(base, 0), props(n, 0)), true);
  assert.equal(floorPropsEqual(props(base, 1), props(n, 1)), false);
});

test('floorPropsEqual: alguien llega al pasillo del piso 1 -> se repinta', () => {
  const c = clone(base);
  c.residents.z = { id: 'z', floorNumber: 1 };
  const n = shareUnchanged(base, c);
  assert.equal(floorPropsEqual(props(base, 0), props(n, 0)), false);
  assert.equal(floorPropsEqual(props(base, 1), props(n, 1)), true);
});

test('floorPropsEqual: cambia la habitacion o una prop simple -> se repinta', () => {
  const c = clone(base);
  c.rooms.r102.occupantId = 'b';
  const n = shareUnchanged(base, c);
  assert.equal(floorPropsEqual(props(base, 0), props(n, 0)), false);
  assert.equal(floorPropsEqual(props(base, 0), props(base, 0, { timeOfDay: 'night' })), false);
  assert.equal(floorPropsEqual(props(base, 0), props(base, 0, { focusedRoomNumber: 101 })), false);
});

test('floorPropsEqual: ocupante que vive en otro piso tambien cuenta', () => {
  const s = clone(base);
  s.residents.a.floorNumber = 9; // dato incoherente, pero el piso 1 lo dibuja
  const s1 = shareUnchanged(s, clone(s));
  const c = clone(s); c.residents.a.stability = 3;
  const s2 = shareUnchanged(s1, c);
  assert.equal(floorPropsEqual(props(s1, 0), props(s2, 0)), false);
});
