import { Router } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../shared/admin";
import { requireAuth } from "../shared/auth";
import { httpError, handleError } from "../shared/errors";

const router = Router();

interface CreateUserBody {
  uid: string;
  email: string;
  role: "client" | "worker" | "both";
  profile: {
    firstName: string;
    lastName: string;
    avatarUrl?: string | null;
    bio?: string;
    gender?: string | null;
    birthdate?: string | null;
  };
  contact: {
    phone: string;
    alternatePhone?: string | null;
    address?: {
      street?: string;
      city?: string;
      zip?: string;
    } | null;
  };
}

/**
 * POST /createUser
 *
 * Crea el documento del usuario en Firestore tras registrarse con Firebase Auth.
 * El frontend crea la cuenta en Auth y luego llama a este endpoint con el UID obtenido.
 *
 * Reglas:
 * - El UID del body debe coincidir con el UID del token (no se puede crear perfil a nombre de otro).
 * - El documento no debe existir previamente.
 * - Solo se crea una vez por usuario.
 */
router.post("/createUser", async (req, res) => {
  try {
    // 1. Autenticación: el token debe pertenecer al usuario que crea su perfil.
    const authenticatedUid = await requireAuth(req);

    const body = req.body as CreateUserBody;

    // 2. Validación del body.
    if (!body.uid || !body.email || !body.role || !body.profile || !body.contact) {
      throw httpError(400, "invalid-argument", "Faltan campos obligatorios: uid, email, role, profile, contact.");
    }

    if (body.uid !== authenticatedUid) {
      throw httpError(403, "permission-denied", "El UID enviado no coincide con el usuario autenticado.");
    }

    if (!["client", "worker", "both"].includes(body.role)) {
      throw httpError(400, "invalid-argument", "El rol debe ser client, worker o both.");
    }

    if (!body.profile.firstName || !body.profile.lastName) {
      throw httpError(400, "invalid-argument", "profile.firstName y profile.lastName son obligatorios.");
    }

    if (!body.contact.phone) {
      throw httpError(400, "invalid-argument", "contact.phone es obligatorio.");
    }

    // 3. Verificar que no exista ya el documento.
    const userRef = db.collection("users").doc(body.uid);
    const existing = await userRef.get();

    if (existing.exists) {
      throw httpError(409, "already-exists", "El usuario ya tiene un perfil creado.");
    }

    // 4. Construir el documento.
    const userDoc: Record<string, unknown> = {
      uid: body.uid,
      email: body.email,
      role: body.role,
      profile: {
        firstName: body.profile.firstName,
        lastName: body.profile.lastName,
        avatarUrl: body.profile.avatarUrl ?? null,
        bio: body.profile.bio ?? "",
        gender: body.profile.gender ?? null,
        birthdate: body.profile.birthdate ?? null,
      },
      contact: {
        phone: body.contact.phone,
        alternatePhone: body.contact.alternatePhone ?? null,
        address: body.contact.address ?? null,
      },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    // 5. Inicializar campos específicos si es trabajador o ambos.
    if (body.role === "worker" || body.role === "both") {
      userDoc.skills = [];
      userDoc.vehicleIds = [];
      userDoc.stats = {
        rating: 0,
        ratingCount: 0,
        completedJobs: 0,
        cancelledJobs: 0,
        responseTimeMin: 0,
      };
      userDoc.availability = {
        isOnline: false,
        workingHours: [],
        serviceArea: null,
      };
    }

    // 6. Crear el documento.
    await userRef.set(userDoc);

    const created = await userRef.get();
    res.status(201).json({
      id: created.id,
      ...created.data(),
    });
  } catch (error) {
    handleError(error, res);
  }
});

export default router;
