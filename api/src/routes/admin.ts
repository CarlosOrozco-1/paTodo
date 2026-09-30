import { Router } from "express";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { auth, db } from "../shared/admin";
import { getAuthenticatedUser } from "../shared/auth";
import { httpError, handleError } from "../shared/errors";

const router = Router();

/**
 * Exige que el llamante tenga el Custom Claim `role = admin`.
 * El claim viaja en el ID token; el admin debe haber refrescado su sesión
 * (getIdToken(true)) después de ser promovido.
 */
async function requireAdmin(request: Parameters<typeof getAuthenticatedUser>[0]) {
  const authenticated = await getAuthenticatedUser(request);
  const role = authenticated.role as string | undefined;
  if (role !== "admin") {
    throw httpError(403, "permission-denied", "Solo los administradores pueden realizar esta acción.");
  }
  return authenticated;
}

/** Convierte un Timestamp/Date de Firestore a string ISO (null si no existe). */
function toISO(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value != null ? String(value) : null;
}

/** Timestamp de "hace N días" para las ventanas de actividad reciente. */
function daysAgo(days: number): Timestamp {
  return Timestamp.fromMillis(Date.now() - days * 24 * 60 * 60 * 1000);
}

interface Pagination {
  page: number;
  limit: number;
}

/** Normaliza los query params ?page y ?limit de la paginación del panel admin. */
function parsePagination(query: Record<string, unknown>): Pagination {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  return { page, limit };
}

/**
 * Registra una acción administrativa en la colección `activity`, que alimenta el
 * feed del dashboard admin (GET /admin/activityLog). Solo la API escribe ahí.
 */
async function logActivity(entry: {
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  description: string;
}): Promise<void> {
  await db.collection("activity").add({
    ...entry,
    createdAt: FieldValue.serverTimestamp(),
  });
}

/**
 * POST /admin/makeAdmin
 *
 * Promueve a un usuario existente a `admin`:
 * - Actualiza `users/{uid}.role = "admin"`.
 * - Publica el Custom Claim `role: admin`.
 *
 * Solo un admin puede llamarlo (la promoción del primer admin se hace con
 * `npm run create-admin`, fuera de la API). El usuario promovido debe
 * refrescar su token (getIdToken(true)) para que el claim llegue a sus peticiones.
 */
router.post("/admin/makeAdmin", async (req, res) => {
  try {
    const admin = await requireAdmin(req);

    const { uid } = req.body as { uid?: string };
    if (!uid) {
      throw httpError(400, "invalid-argument", "Falta el campo uid.");
    }

    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw httpError(404, "not-found", "El usuario no existe.");
    }

    await userRef.update({
      role: "admin",
      updatedAt: FieldValue.serverTimestamp(),
    });

    await auth.setCustomUserClaims(uid, { role: "admin" });

    await logActivity({
      userId: admin.uid,
      userName: admin.email ?? "admin",
      action: "make_admin",
      entityType: "user",
      entityId: uid,
      description: "Usuario promovido a administrador",
    });

    res.status(200).json({ id: uid, role: "admin" });
  } catch (error) {
    handleError(error, res);
  }
});

/**
 * POST /admin/removeAdmin
 *
 * Revierte a un usuario `admin` a un usuario `client`:
 * - Actualiza `users/{uid}.role = "client"`.
 * - Actualiza el Custom Claim `role: client`.
 *
 * Solo un admin puede llamarlo y no puede rebajarse a sí mismo. El usuario
 * rebajado debe refrescar su token (getIdToken(true)).
 */
router.post("/admin/removeAdmin", async (req, res) => {
  try {
    const authenticated = await requireAdmin(req);

    const { uid } = req.body as { uid?: string };
    if (!uid) {
      throw httpError(400, "invalid-argument", "Falta el campo uid.");
    }

    if (uid === authenticated.uid) {
      throw httpError(400, "invalid-argument", "No puedes revocar tu propio rol de administrador.");
    }

    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw httpError(404, "not-found", "El usuario no existe.");
    }

    await userRef.update({
      role: "client",
      updatedAt: FieldValue.serverTimestamp(),
    });

    await auth.setCustomUserClaims(uid, { role: "client" });

    await logActivity({
      userId: authenticated.uid,
      userName: authenticated.email ?? "admin",
      action: "remove_admin",
      entityType: "user",
      entityId: uid,
      description: "Rol de administrador revocado",
    });

    res.status(200).json({ id: uid, role: "client" });
  } catch (error) {
    handleError(error, res);
  }
});

/**
 * GET /admin/stats
 *
 * Resumen agregado para el dashboard admin: conteos por rol, estados de
 * trabajos, ofertas, calificación promedio y actividad de la última semana.
 */
router.get("/admin/stats", async (req, res) => {
  try {
    await requireAdmin(req);

    const [usersSnap, jobsSnap, offersSnap, reviewsSnap] = await Promise.all([
      db.collection("users").get(),
      db.collection("jobs").get(),
      db.collection("offers").get(),
      db.collection("reviews").get(),
    ]);

    let totalUsers = 0;
    let totalClients = 0;
    let totalWorkers = 0;
    let totalAdmins = 0;
    let totalJobs = 0;
    let activeJobs = 0;
    let pendingJobs = 0;
    let completedJobs = 0;
    let cancelledJobs = 0;
    let totalOffers = 0;
    let pendingOffers = 0;
    let acceptedOffers = 0;
    let newUsersThisWeek = 0;
    let newJobsThisWeek = 0;
    let ratingSum = 0;
    let ratingCount = 0;

    const weekAgo = daysAgo(7);

    usersSnap.forEach((doc) => {
      const data = doc.data() as Record<string, any>;
      totalUsers += 1;

      const role = data.role as string | undefined;
      if (role === "client") totalClients += 1;
      if (role === "worker") totalWorkers += 1;
      // "both" cuenta como cliente y como trabajador en ambos totales.
      if (role === "both") {
        totalClients += 1;
        totalWorkers += 1;
      }
      if (role === "admin") totalAdmins += 1;

      if (data.createdAt instanceof Timestamp && data.createdAt >= weekAgo) {
        newUsersThisWeek += 1;
      }
    });

    jobsSnap.forEach((doc) => {
      const data = doc.data() as Record<string, any>;
      totalJobs += 1;

      const status = data.status as string | undefined;
      if (status === "pending") pendingJobs += 1;
      if (status === "accepted" || status === "in_progress") activeJobs += 1;
      if (status === "completed") completedJobs += 1;
      if (status === "cancelled") cancelledJobs += 1;

      if (data.createdAt instanceof Timestamp && data.createdAt >= weekAgo) {
        newJobsThisWeek += 1;
      }
    });

    offersSnap.forEach((doc) => {
      const data = doc.data() as Record<string, any>;
      totalOffers += 1;
      if (data.status === "pending") pendingOffers += 1;
      if (data.status === "accepted") acceptedOffers += 1;
    });

    reviewsSnap.forEach((doc) => {
      const rating = Number((doc.data() as Record<string, any>).rating);
      if (!Number.isNaN(rating)) {
        ratingSum += rating;
        ratingCount += 1;
      }
    });

    res.status(200).json({
      totalUsers,
      totalClients,
      totalWorkers,
      totalAdmins,
      totalJobs,
      activeJobs,
      pendingJobs,
      completedJobs,
      cancelledJobs,
      totalOffers,
      pendingOffers,
      acceptedOffers,
      averageRating: ratingCount === 0 ? 0 : Number((ratingSum / ratingCount).toFixed(2)),
      totalRevenue: 0,
      currency: "GTQ",
      // Sin pasarela de pagos no hay actividad de sesión ni ingresos reales:
      // se reportan en 0 hasta que exista ese dato.
      activeUsersToday: 0,
      newUsersThisWeek,
      newJobsThisWeek,
    });
  } catch (error) {
    handleError(error, res);
  }
});

/**
 * GET /admin/users
 *
 * Lista paginada de usuarios con filtros por rol, estado y búsqueda por
 * nombre o correo (subcadena, sin distinguir mayúsculas).
 */
router.get("/admin/users", async (req, res) => {
  try {
    await requireAdmin(req);

    const { page, limit } = parsePagination(req.query as Record<string, unknown>);
    const role = typeof req.query.role === "string" && req.query.role ? req.query.role : undefined;
    const status = typeof req.query.status === "string" && req.query.status ? req.query.status : undefined;
    const search = typeof req.query.search === "string" ? req.query.search.trim().toLowerCase() : "";

    const snapshot = await db.collection("users").orderBy("createdAt", "desc").get();
    const filtered: Array<Record<string, any>> = [];

    snapshot.forEach((doc) => {
      const data = doc.data() as Record<string, any>;

      if (role && data.role !== role) return;
      // Los usuarios previos al campo status se tratan como "active".
      if (status && (data.status ?? "active") !== status) return;

      if (search) {
        const email = String(data.email ?? "").toLowerCase();
        const firstName = String(data.profile?.firstName ?? "").toLowerCase();
        const lastName = String(data.profile?.lastName ?? "").toLowerCase();
        const fullName = `${firstName} ${lastName}`;
        const matches =
          email.includes(search) ||
          fullName.includes(search) ||
          firstName.includes(search) ||
          lastName.includes(search);
        if (!matches) return;
      }

      filtered.push({
        id: doc.id,
        email: data.email ?? null,
        firstName: data.profile?.firstName ?? "",
        lastName: data.profile?.lastName ?? "",
        avatarUrl: data.profile?.avatarUrl ?? null,
        role: data.role ?? "client",
        status: data.status ?? "active",
        verified: Boolean(data.verified),
        phone: data.contact?.phone ?? null,
        rating: Number(data.stats?.rating ?? 0),
        ratingCount: Number(data.stats?.ratingCount ?? 0),
        completedJobs: Number(data.stats?.completedJobs ?? 0),
        createdAt: toISO(data.createdAt),
      });
    });

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;

    res.status(200).json({
      items: filtered.slice(start, start + limit),
      total,
      page,
      limit,
      totalPages,
    });
  } catch (error) {
    handleError(error, res);
  }
});

/**
 * PATCH /admin/users/{uid}/role
 *
 * Cambia el rol de un usuario a client, worker o both (actualiza el documento y
 * el Custom Claim). Para promover o revocar el rol admin existen makeAdmin y
 * removeAdmin, que además exigen el claim admin.
 */
router.patch("/admin/users/:uid/role", async (req, res) => {
  try {
    const admin = await requireAdmin(req);

    const { uid } = req.params as { uid: string };
    const { role } = req.body as { role?: string };

    if (!uid) {
      throw httpError(400, "invalid-argument", "Falta el uid del usuario.");
    }
    if (!role || !["client", "worker", "both"].includes(role)) {
      throw httpError(400, "invalid-argument", "El rol debe ser client, worker o both.");
    }

    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      throw httpError(404, "not-found", "El usuario no existe.");
    }

    await userRef.update({ role, updatedAt: FieldValue.serverTimestamp() });
    await auth.setCustomUserClaims(uid, { role });

    await logActivity({
      userId: admin.uid,
      userName: admin.email ?? "admin",
      action: "change_role",
      entityType: "user",
      entityId: uid,
      description: `Rol cambiado a ${role}`,
    });

    res.status(200).json({ id: uid, role });
  } catch (error) {
    handleError(error, res);
  }
});

/**
 * POST /admin/suspendUser
 *
 * Marca la cuenta como `status: suspended`. Un admin no puede ser suspendido.
 */
router.post("/admin/suspendUser", async (req, res) => {
  try {
    const admin = await requireAdmin(req);

    const { uid } = req.body as { uid?: string };
    if (!uid) {
      throw httpError(400, "invalid-argument", "Falta el campo uid.");
    }

    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      throw httpError(404, "not-found", "El usuario no existe.");
    }
    if (userDoc.data()?.role === "admin") {
      throw httpError(403, "permission-denied", "No se puede suspender a un administrador.");
    }

    await userRef.update({ status: "suspended", updatedAt: FieldValue.serverTimestamp() });

    await logActivity({
      userId: admin.uid,
      userName: admin.email ?? "admin",
      action: "suspend_user",
      entityType: "user",
      entityId: uid,
      description: "Cuenta suspendida",
    });

    res.status(200).json({ id: uid, status: "suspended" });
  } catch (error) {
    handleError(error, res);
  }
});

/**
 * POST /admin/activateUser
 *
 * Devuelve la cuenta a `status: active`, restaurando sus escrituras.
 */
router.post("/admin/activateUser", async (req, res) => {
  try {
    const admin = await requireAdmin(req);

    const { uid } = req.body as { uid?: string };
    if (!uid) {
      throw httpError(400, "invalid-argument", "Falta el campo uid.");
    }

    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      throw httpError(404, "not-found", "El usuario no existe.");
    }

    await userRef.update({ status: "active", updatedAt: FieldValue.serverTimestamp() });

    await logActivity({
      userId: admin.uid,
      userName: admin.email ?? "admin",
      action: "activate_user",
      entityType: "user",
      entityId: uid,
      description: "Cuenta reactivada",
    });

    res.status(200).json({ id: uid, status: "active" });
  } catch (error) {
    handleError(error, res);
  }
});

/**
 * POST /admin/verifyWorker
 *
 * Marca `verified: true/false` en el perfil de un trabajador.
 */
router.post("/admin/verifyWorker", async (req, res) => {
  try {
    const admin = await requireAdmin(req);

    const { workerId, approve } = req.body as { workerId?: string; approve?: unknown };
    if (!workerId) {
      throw httpError(400, "invalid-argument", "Falta el campo workerId.");
    }
    if (typeof approve !== "boolean") {
      throw httpError(400, "invalid-argument", "Falta el campo approve (booleano).");
    }

    const userRef = db.collection("users").doc(workerId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      throw httpError(404, "not-found", "El trabajador no existe.");
    }

    await userRef.update({ verified: approve, updatedAt: FieldValue.serverTimestamp() });

    await logActivity({
      userId: admin.uid,
      userName: admin.email ?? "admin",
      action: approve ? "verify_worker" : "unverify_worker",
      entityType: "user",
      entityId: workerId,
      description: approve ? "Trabajador verificado" : "Verificación del trabajador rechazada",
    });

    res.status(200).json({ id: workerId, verified: approve });
  } catch (error) {
    handleError(error, res);
  }
});

/**
 * GET /admin/jobs
 *
 * Lista paginada de todos los trabajos, con filtro opcional por estado.
 */
router.get("/admin/jobs", async (req, res) => {
  try {
    await requireAdmin(req);

    const { page, limit } = parsePagination(req.query as Record<string, unknown>);
    const status = typeof req.query.status === "string" && req.query.status ? req.query.status : undefined;

    const snapshot = await db.collection("jobs").orderBy("createdAt", "desc").get();
    const filtered: Array<Record<string, any>> = [];

    snapshot.forEach((doc) => {
      const data = doc.data() as Record<string, any>;
      if (status && data.status !== status) return;
      filtered.push({ id: doc.id, ...data });
    });

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;

    res.status(200).json({
      items: filtered.slice(start, start + limit),
      total,
      page,
      limit,
      totalPages,
    });
  } catch (error) {
    handleError(error, res);
  }
});

/**
 * GET /admin/activityLog
 *
 * Últimas acciones administrativas registradas (colección `activity`).
 */
router.get("/admin/activityLog", async (req, res) => {
  try {
    await requireAdmin(req);

    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const snapshot = await db.collection("activity").orderBy("createdAt", "desc").limit(limit).get();

    const items = snapshot.docs.map((doc) => {
      const data = doc.data() as Record<string, any>;
      return {
        id: doc.id,
        userId: data.userId ?? "",
        userName: data.userName ?? "",
        action: data.action ?? "",
        entityType: data.entityType ?? "",
        entityId: data.entityId ?? "",
        description: data.description ?? "",
        createdAt: toISO(data.createdAt),
      };
    });

    res.status(200).json({ items });
  } catch (error) {
    handleError(error, res);
  }
});

export default router;