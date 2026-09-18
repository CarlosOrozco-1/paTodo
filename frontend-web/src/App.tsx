/**
 * PaTodo — Frontend Web (base de integración)
 *
 * Esta carpeta NO contiene la aplicación web: el equipo de frontend ya tiene su
 * propio repositorio. Aquí solo está lo mínimo para conectar con el backend:
 *
 * - src/lib/firebase.ts  → inicializa Firebase (Auth + Firestore) con emuladores.
 * - src/lib/api.ts       → cliente HTTP para la API REST transaccional.
 * - .env.example         → variables de entorno (API key, URLs, emuladores).
 *
 * Usa estas bases para conectar tu app en el repo del equipo.
 */
export default function App() {
  return (
    <main style={{ fontFamily: "system-ui", padding: 24, maxWidth: 720 }}>
      <h1>PaTodo — Base de integración (web)</h1>
      <p>
        Conecta aquí tu app usando <code>src/lib/firebase.ts</code> y{" "}
        <code>src/lib/api.ts</code>. Ver README.md en la raíz de frontend-web.
      </p>
    </main>
  );
}