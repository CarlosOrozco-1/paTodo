import * as fs from "fs";
import * as path from "path";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp, GeoPoint } from "firebase-admin/firestore";
import Ajv, { ValidateFunction, ErrorObject } from "ajv";
import addFormats from "ajv-formats";

// Inicializar admin con projectId explícito para el emulador.
initializeApp({ projectId: "pa-todo" });

const db = getFirestore();

const SCHEMAS_DIR = path.resolve(__dirname, "../../../spec/schemas");

const COLLECTION_SCHEMAS = {
  categories: "categories.json",
  conversations: "conversations.json",
  jobs: "job.json",
  notifications: "notifications.json",
  offers: "offer.json",
  reviews: "review.json",
  skills: "skills.json",
  users: "user.json",
  vehicles: "vehicle.json",
} as const;

type CollectionName = keyof typeof COLLECTION_SCHEMAS;

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const compiled: Record<string, ValidateFunction> = {};

let failures = 0;

/**
 * Convierte valores de Firestore (Timestamp, GeoPoint) a JSON válido.
 * @param {unknown} value - Valor almacenado en Firestore.
 * @return {unknown} Valor JSON con fechas en ISO-8601.
 */
function normalize(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof GeoPoint) {
    return { latitude: value.latitude, longitude: value.longitude };
  }
  if (Array.isArray(value)) return value.map((item) => normalize(item));
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = normalize(item);
    }
    return out;
  }
  return value;
}

/**
 * Carga y compila el schema asociado a una colección.
 * @param {CollectionName} name - Nombre de la colección.
 * @return {ValidateFunction} Función de validación de ajv.
 */
function getValidator(name: CollectionName): ValidateFunction {
  if (!compiled[name]) {
    const raw = fs.readFileSync(
      path.join(SCHEMAS_DIR, COLLECTION_SCHEMAS[name]),
      "utf8"
    );
    compiled[name] = ajv.compile(JSON.parse(raw));
  }
  return compiled[name];
}

/**
 * Formatea los errores de ajv en una sola línea legible.
 * @param {ErrorObject[]} errors - Errores devueltos por ajv.
 * @return {string} Lista de errores separados por " | ".
 */
function formatErrors(errors: ErrorObject[]): string {
  return errors
    .map((err) => `${err.instancePath || "/"} ${err.message}`)
    .join(" | ");
}

/**
 * Valida todos los documentos de una colección contra su schema.
 * @param {CollectionName} name - Nombre de la colección.
 * @return {Promise<void>}
 */
async function validateCollection(name: CollectionName): Promise<void> {
  const validate = getValidator(name);
  const snapshot = await db.collection(name).get();
  let fails = 0;
  for (const doc of snapshot.docs) {
    const data = normalize(doc.data());
    if (!validate(data)) {
      fails += 1;
      failures += 1;
      console.error(
        `  ✗ ${name}/${doc.id}: ${formatErrors(validate.errors || [])}`
      );
    }
  }
  const status = fails === 0 ? "✅" : `❌ ${fails} docs fallan`;
  console.log(`  ${status} ${name}: ${snapshot.size} docs`);
}

/**
 * Valida los mensajes de todas las conversaciones contra message.json.
 * @return {Promise<void>}
 */
async function validateMessages(): Promise<void> {
  const raw = fs.readFileSync(path.join(SCHEMAS_DIR, "message.json"), "utf8");
  const validate = ajv.compile(JSON.parse(raw));
  const conversations = await db.collection("conversations").get();
  let total = 0;
  let fails = 0;
  for (const conv of conversations.docs) {
    const snapshot = await conv.ref.collection("messages").get();
    total += snapshot.size;
    for (const doc of snapshot.docs) {
      const data = normalize(doc.data());
      if (!validate(data)) {
        fails += 1;
        failures += 1;
        console.error(
          `  ✗ conversations/${conv.id}/messages/${doc.id}: ${formatErrors(
            validate.errors || []
          )}`
        );
      }
    }
  }
  const status = fails === 0 ? "✅" : `❌ ${fails} mensajes fallan`;
  console.log(`  ${status} messages: ${total} docs`);
}

/**
 * Punto de entrada: valida todas las colecciones contra sus schemas.
 * @return {Promise<void>}
 */
async function main(): Promise<void> {
  console.log("🔎 Validando datos contra spec/schemas...\n");
  for (const name of Object.keys(COLLECTION_SCHEMAS) as CollectionName[]) {
    await validateCollection(name);
  }
  await validateMessages();
  console.log(
    failures === 0 ?
      "\n=== ✅ TODOS LOS SCHEMAS CUMPLEN ===" :
      `\n=== ❌ ${failures} DOCUMENTOS CON ERRORES ===`
  );
}

main()
  .then(() => process.exit(failures === 0 ? 0 : 1))
  .catch((err) => {
    console.error("❌ Error en validación:", err);
    process.exit(1);
  });
