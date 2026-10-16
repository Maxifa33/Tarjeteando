import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Invariante: 'Empezar de cero' nunca borra las reservas manuales (no se pueden reimportar).
// Es un test de código fuente porque repo.js necesita Supabase para correr.
test("borrarTodo solo borra bolsillos con origen 'importada'", () => {
  const src = readFileSync(new URL('./repo.js', import.meta.url), 'utf8');
  const cuerpo = src.slice(src.indexOf('export async function borrarTodo'), src.indexOf('export async function actualizarMovimiento'));
  const linea = cuerpo.split('\n').find((l) => l.includes("from('bolsillos').delete()"));
  assert.ok(linea, 'borrarTodo debe borrar bolsillos');
  assert.match(linea, /\.eq\('origen', 'importada'\)/);
});
