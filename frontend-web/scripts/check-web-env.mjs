import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnv } from 'vite';

// Falla el build de producción si el bundle se compilaría sin conexión a
// Firebase/API. Existe porque Vite incrusta el .env al compilar: si una máquina
// no lo tiene, la app cae silenciosamente a datos simulados en localStorage y se
// publica en pa-todo.web.app como si fueran los reales.

const REQUIRED = [
  ['VITE_FIREBASE_API_KEY', 'clave de API de Firebase'],
  ['VITE_FIREBASE_AUTH_DOMAIN', 'dominio de autenticación'],
  ['VITE_FIREBASE_PROJECT_ID', 'ID del proyecto de Firebase'],
  ['VITE_FIREBASE_APP_ID', 'ID de la app web'],
  ['VITE_API_URL', 'URL de la API REST'],
];

const PLACEHOLDER = /<[^>]+>|TU[_-]|AQU[IÍ]|CHANGE[_-]?ME|REEMPLAZ|XXX+/i;

const RECOMENDADAS = [
  ['VITE_MAPBOX_TOKEN', 'token de Mapbox (sin él el mapa de rutas no dibuja)'],
];

const cwd = process.cwd();
const mode = 'production';
const env = loadEnv(mode, cwd, 'VITE_');

const errores = [];

const apiMode = (env.VITE_API_MODE ?? '').trim();

if (!apiMode) {
  errores.push(
    `VITE_API_MODE no está definido (leído como "${apiMode}").\n` +
      `    Sin él la app arranca en modo demo y publicaría datos simulados.`,
  );
} else if (apiMode !== 'real') {
  const porque =
    apiMode === 'auto'
      ? 'en modo `auto` la app cae a datos simulados si la API no responde'
      : `en modo \`${apiMode}\``;
  errores.push(`VITE_API_MODE="${apiMode}" no sirve para producción: ${porque}.`);
}

for (const [clave, queEs] of REQUIRED) {
  const valor = (env[clave] ?? '').trim();
  if (!valor) {
    errores.push(`${clave} falta o está vacío (${queEs}).`);
  } else if (PLACEHOLDER.test(valor)) {
    errores.push(`${clave} sigue con el valor de ejemplo "${valor}" de .env.example.`);
  }
}

const avisos = [];
for (const [clave, queEs] of RECOMENDADAS) {
  const valor = (env[clave] ?? '').trim();
  if (!valor) {
    avisos.push(`${clave} no está definido (${queEs}).`);
  } else if (PLACEHOLDER.test(valor)) {
    avisos.push(`${clave} tiene el valor de ejemplo "${valor}" (${queEs}).`);
  }
}

function mostrarAvisos() {
  if (avisos.length === 0) return;
  console.warn('\n[build] Avisos (no bloquean el build):');
  for (const a of avisos) console.warn(`   - ${a}`);
  console.warn('');
}

if (errores.length > 0) {
  if (process.env.ALLOW_DEMO_BUILD === '1') {
    console.warn(
      '[build] ALLOW_DEMO_BUILD=1 · se compila SIN datos reales. No publiques este bundle en Hosting.\n',
    );
    process.exit(0);
  }

  const hayEnv = existsSync(resolve(cwd, '.env'));
  console.error('\n[build] Cancelado: el bundle se publicaría SIN datos reales.\n');
  console.error(`  Modo de Vite: ${mode}`);
  console.error(`  .env presente: ${hayEnv ? 'sí' : 'NO (no existe frontend-web/.env)'}`);
  console.error('\n  Problemas:');
  for (const e of errores) console.error(`   - ${e}`);
  console.error('\n  Cómo resolverlo:');
  console.error('   1. Copia la plantilla y completa los valores:');
  console.error('        cp .env.example .env');
  console.error('   2. VITE_API_MODE debe quedar en `real`.');
  console.error('   3. VITE_FIREBASE_* debe ser el proyecto `pa-todo` (producción).');
  console.error('\n  ¿Necesitas un build demo a propósito? entonces:');
  console.error('        ALLOW_DEMO_BUILD=1 npm run build');
  console.error('  Ese build queda marcado como simulado: no lo publiques en Hosting.\n');
  mostrarAvisos();
  process.exit(1);
}

console.log(
  `[build] OK · modo=${apiMode} · firebase=${env.VITE_FIREBASE_PROJECT_ID} · api=${env.VITE_API_URL}`,
);
mostrarAvisos();
