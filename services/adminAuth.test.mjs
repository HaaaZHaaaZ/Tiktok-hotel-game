import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = '.tmp-test-auth';

execFileSync('npx', ['tsc', 'services/adminAuth.ts',
  '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler',
  '--skipLibCheck', '--types', 'node', '--outDir', OUT], { cwd: ROOT, stdio: 'inherit' });

const { passwordValida, passwordCorrecta, firmarSesion, tokenValido, SESION_MS, PASSWORD_POR_DEFECTO } =
  await import(`../${OUT}/adminAuth.js`);

const PROD = { NODE_ENV: 'production' };
const DEV = { NODE_ENV: 'development' };

test('produccion sin ADMIN_PASSWORD: bloqueado, la clave por defecto NO entra', () => {
  assert.deepEqual(passwordValida(PROD), { pass: null, porDefecto: false, bloqueado: true });
  assert.equal(passwordCorrecta(PASSWORD_POR_DEFECTO, PROD), false);
  assert.equal(passwordCorrecta('', PROD), false);
});

test('produccion sin ADMIN_PASSWORD: ningun token vale', () => {
  const marca = Date.now();
  assert.equal(tokenValido(`${marca}.${firmarSesion(marca, PASSWORD_POR_DEFECTO)}`, PROD), false);
});

test('ADMIN_PASSWORD en blanco cuenta como no definida', () => {
  assert.equal(passwordValida({ ...PROD, ADMIN_PASSWORD: '   ' }).bloqueado, true);
});

test('desarrollo sin ADMIN_PASSWORD: usa la de desarrollo y lo avisa', () => {
  assert.deepEqual(passwordValida(DEV), { pass: PASSWORD_POR_DEFECTO, porDefecto: true, bloqueado: false });
  assert.equal(passwordCorrecta(PASSWORD_POR_DEFECTO, DEV), true);
});

test('con ADMIN_PASSWORD: solo entra esa', () => {
  const env = { ...PROD, ADMIN_PASSWORD: 's3creta' };
  assert.equal(passwordCorrecta('s3creta', env), true);
  assert.equal(passwordCorrecta(PASSWORD_POR_DEFECTO, env), false);
  assert.equal(passwordCorrecta('s3cret', env), false);
});

test('token: valido, caducado, futuro, manipulado y de otra contrasena', () => {
  const env = { ...PROD, ADMIN_PASSWORD: 's3creta' };
  const ahora = 1_800_000_000_000;
  const ok = `${ahora}.${firmarSesion(ahora, 's3creta')}`;
  assert.equal(tokenValido(ok, env, ahora), true);
  assert.equal(tokenValido(ok, env, ahora + SESION_MS + 1), false);
  const futuro = ahora + 10 * 60_000;
  assert.equal(tokenValido(`${futuro}.${firmarSesion(futuro, 's3creta')}`, env, ahora), false);
  assert.equal(tokenValido(`${ahora + 1}.${firmarSesion(ahora, 's3creta')}`, env, ahora + 1), false);
  assert.equal(tokenValido(`${ahora}.${firmarSesion(ahora, 'otra')}`, env, ahora), false);
  assert.equal(tokenValido(undefined, env, ahora), false);
  assert.equal(tokenValido('basura', env, ahora), false);
});
