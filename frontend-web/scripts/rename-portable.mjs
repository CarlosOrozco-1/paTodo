import { cpSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(process.cwd(), 'demohtml');
const src = join(dir, 'index.html');
const dest = join(dir, 'PaTodo-portable.html');

cpSync(src, dest);
rmSync(src, { force: true });

// Elimina assets copiados desde public/ que ya quedaron embebidos en el HTML
// para que demohtml/ contenga solo el archivo portable.
for (const file of readdirSync(dir)) {
  if (file !== 'PaTodo-portable.html') {
    rmSync(join(dir, file), { recursive: true, force: true });
  }
}

console.log(`Archivo portable: demohtml/PaTodo-portable.html`);