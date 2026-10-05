import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadEnv } from 'vite';

// Comprueba que el bundle recién compilado realmente incrustó el .env. El
// guardián previo (check-web-env.mjs) valida la configuración; esto confirma que
// los valores llegaron al bundle, que es lo que se pierde al publicar.

const cwd = process.cwd();
const dist = resolve(cwd, 'dist');

if (!existsSync(dist)) {
  console.error('[verify] No existe frontend-web/dist/. Ejecuta primero el build.');
  process.exit(1);
}

const assetsDir = resolve(dist, 'assets');
if (!existsSync(assetsDir)) {
  console.error('[verify] No existe frontend-web/dist/assets/. ¿El build terminó bien?');
  process.exit(1);
}

const jsFiles = readdirSync(assetsDir).filter((f) => f.endsWith('.js'));
if (jsFiles.length === 0) {
  console.error('[verify] dist/assets no contiene ningún .js.');
  process.exit(1);
}

const bundle = jsFiles
  .map((f) => readFileSync(join(assetsDir, f), 'utf8'))
  .join('\n');

const env = loadEnv('production', cwd, 'VITE_');

const MARCADORES = [
  ['VITE_FIREBASE_PROJECT_ID', env.VITE_FIREBASE_PROJECT_ID],
  ['VITE_FIREBASE_AUTH_DOMAIN', env.VITE_FIREBASE_AUTH_DOMAIN],
  ['VITE_API_URL', env.VITE_API_URL],
];

const faltan = MARCADORES.filter(
  ([, valor]) => !valor || !valor.trim() || !bundle.includes(valor.trim()),
);

const kb = Math.round(bundle.length / 1024);

if (faltan.length > 0) {
  console.error('\n[verify] El bundle NO contiene la configuración de .env.\n');
  for (const [clave] of faltan) console.error(`   - ${clave} no aparece en dist/assets/`);
  console.error(
    '\n  Suele significar que el build corrió sin .env: la app se publicaría con\n' +
      '  datos simulados en vez de los de Firebase.\n',
  );
  process.exit(1);
}

const tamanoDist = readdirSync(dist).length;
console.log(
  `[verify] OK · ${jsFiles.length} archivo(s) JS (${kb} KB) · dist/ con ${tamanoDist} entradas · config de .env incrustada`,
);
