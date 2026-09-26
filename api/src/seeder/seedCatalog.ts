import "dotenv/config";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../shared/admin";

interface CategorySeed {
  name: string;
  slug: string;
  description: string;
  icon?: string;
  color?: string;
  imageUrl?: string;
  parentId?: string | null;
  sortOrder: number;
}

interface SkillSeed {
  name: string;
  slug: string;
  description: string;
  icon?: string;
}

const categories: CategorySeed[] = [
  { name: "Mecánica", slug: "mecanica", description: "Reparación y mantenimiento de vehículos", icon: "wrench", color: "#3b82f6", sortOrder: 1 },
  { name: "Plomería", slug: "plomeria", description: "Instalación y reparación de tuberías y grifería", icon: "droplets", color: "#06b6d4", sortOrder: 2 },
  { name: "Electricidad", slug: "electricidad", description: "Instalaciones y reparaciones eléctricas", icon: "zap", color: "#f59e0b", sortOrder: 3 },
  { name: "Carpintería", slug: "carpinteria", description: "Muebles y trabajos en madera", icon: "hammer", color: "#f97316", sortOrder: 4 },
  { name: "Pintura", slug: "pintura", description: "Pintura de interiores y exteriores", icon: "paintbrush", color: "#ec4899", sortOrder: 5 },
  { name: "Jardinería", slug: "jardineria", description: "Diseño y mantenimiento de jardines", icon: "flower", color: "#22c55e", sortOrder: 6 },
  { name: "Limpieza", slug: "limpieza", description: "Limpieza de hogares y oficinas", icon: "sparkles", color: "#64748b", sortOrder: 7 },
  { name: "Abogado", slug: "abogado", description: "Asesoría y servicios legales", icon: "scale", color: "#8b5cf6", sortOrder: 8 },
];

const skills: SkillSeed[] = [
  { name: "Cambio de llantas", slug: "cambio-llantas", description: "Reemplazo de llantas ponchadas", icon: "tire" },
  { name: "Reparación de motor", slug: "reparacion-motor", description: "Diagnóstico y reparación de motores", icon: "engine" },
  { name: "Batería", slug: "bateria", description: "Cambio y carga de baterías", icon: "battery" },
  { name: "Plomería", slug: "plomeria-skill", description: "Instalación y reparación de tuberías", icon: "droplets" },
  { name: "Fontanería", slug: "fontaneria", description: "Reparación de grifos y conexiones", icon: "faucet" },
  { name: "Instalación eléctrica", slug: "instalacion-electrica", description: "Instalación de circuitos y contactos", icon: "zap" },
  { name: "Cableado", slug: "cableado", description: "Tendido y reparación de cableado", icon: "cable" },
  { name: "Reparación de muebles", slug: "reparacion-muebles", description: "Arreglo y restauración de muebles", icon: "hammer" },
  { name: "Pintura interior", slug: "pintura-interior", description: "Pintura de paredes y techos", icon: "paintbrush" },
  { name: "Jardinería", slug: "jardineria-skill", description: "Diseño y mantenimiento de jardines", icon: "flower" },
  { name: "Limpieza doméstica", slug: "limpieza-domestica", description: "Limpieza de hogares y oficinas", icon: "sparkles" },
  { name: "Asesoría legal", slug: "asesoria-legal", description: "Consultas y trámites legales", icon: "scale" },
];

async function seedCategories(): Promise<void> {
  console.log("📂 Sembrando categorías...");
  for (const cat of categories) {
    await db.collection("categories").doc(cat.slug).set(
      {
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        icon: cat.icon ?? null,
        color: cat.color ?? null,
        imageUrl: cat.imageUrl ?? null,
        parentId: cat.parentId ?? null,
        isActive: true,
        sortOrder: cat.sortOrder,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    console.log(`  ✔ ${cat.slug}`);
  }
}

async function seedSkills(): Promise<void> {
  console.log("🛠 Sembrando skills...");
  for (const skill of skills) {
    await db.collection("skills").doc(skill.slug).set(
      {
        name: skill.name,
        slug: skill.slug,
        description: skill.description,
        icon: skill.icon ?? null,
        isActive: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    console.log(`  ✔ ${skill.slug}`);
  }
}

async function main(): Promise<void> {
  await seedCategories();
  await seedSkills();
  console.log("\n=== ✅ CATÁLOGO SEMBRADO ===");
  console.log(`${categories.length} categorías, ${skills.length} skills.`);
  console.log("IDs estables = slug (ej. categoryId: 'mecanica').");
  console.log("Reglas de Firestore: lectura pública, escritura bloqueada.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error en seed de catálogo:", err);
    process.exit(1);
  });