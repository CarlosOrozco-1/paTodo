import { FieldValue } from "firebase-admin/firestore";
import { db, messaging } from "./admin";

export type NotificationType =
  | "new_offer"
  | "offer_received"
  | "offer_accepted"
  | "offer_rejected"
  | "new_message"
  | "job_started"
  | "job_completed"
  | "job_cancelled"
  | "new_review"
  | "payment_received"
  | "voice_call_incoming";

export interface NotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: {
    jobId?: string;
    offerId?: string;
    conversationId?: string;
    senderName?: string;
    messagePreview?: string;
  };
}

/**
 * Envía un push a los tokens FCM de un usuario y limpia los tokens inválidos.
 * Devuelve false si el usuario no existe o no tiene tokens.
 */
async function pushToUser(
  userId: string,
  message: {
    notification?: { title: string; body: string };
    data: Record<string, string>;
    android?: { priority: "high" | "normal"; ttl?: number };
  }
): Promise<boolean> {
  const userDoc = await db.collection("users").doc(userId).get();

  if (!userDoc.exists) {
    console.warn(`PUSH_SKIPPED_USER_NOT_FOUND: ${userId}`);
    return false;
  }

  const fcmTokens: string[] = userDoc.data()?.fcmTokens ?? [];
  if (fcmTokens.length === 0) {
    // DEV: el aviso ya quedó creado en Firestore; este log permite distinguir
    // "sin token registrado" de un error real de FCM al depurar Render.
    console.warn(`PUSH_SKIPPED_NO_DEVICE_TOKEN: ${userId}`);
    return false;
  }

  const pushResponse = await messaging.sendEachForMulticast({
    tokens: fcmTokens,
    ...message,
  });

  const invalidTokens: string[] = [];
  pushResponse.responses.forEach((resp, index) => {
    if (!resp.success) {
      const code = resp.error?.code;
      if (
        code === "messaging/invalid-registration-token" ||
        code === "messaging/registration-token-not-registered"
      ) {
        const token = fcmTokens[index];
        if (token) invalidTokens.push(token);
      }
    }
  });

  if (invalidTokens.length > 0) {
    await userDoc.ref.update({
      fcmTokens: FieldValue.arrayRemove(...invalidTokens),
    });
  }

  const delivered = pushResponse.responses.filter((response) => response.success)
    .length;
  if (delivered === 0) {
    console.warn(`PUSH_NOT_DELIVERED: ${userId}`);
  }

  return delivered > 0;
}

/**
 * Crea una notificación en Firestore y envía el push por FCM.
 * Retorna el ID del documento de notificación creado.
 */
export async function createAndSendNotification(
  payload: NotificationPayload
): Promise<string> {
  const notificationRef = db.collection("notifications").doc();

  await notificationRef.set({
    userId: payload.userId,
    type: payload.type,
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
    isRead: false,
    readAt: null,
    createdAt: FieldValue.serverTimestamp(),
  });

  await pushToUser(payload.userId, {
    notification: { title: payload.title, body: payload.body },
    data: {
      type: payload.type,
      jobId: payload.data?.jobId ?? "",
      offerId: payload.data?.offerId ?? "",
      conversationId: payload.data?.conversationId ?? "",
      senderName: payload.data?.senderName ?? "",
      messagePreview: payload.data?.messagePreview ?? "",
    },
  });

  return notificationRef.id;
}

/**
 * Push de llamada de voz entrante.
 *
 * Diferencias frente a una notificación normal, y son obligatorias:
 *
 * - `priority: high` / `ttl`: una llamada entrante solo sirve si el teléfono
 *   despierto al instante. Con prioridad normal Android la aplaza y el usuario
 *   ve la llamada demasiado tarde (o nunca, si la app está en background).
 * - El `data` lleva `callId` y `direction: incoming`. Sin el `callId` el
 *   receptor no sabe qué llamada abrir.
 *
 * Lo que NO puede hacer la API es abrir la pantalla: eso lo decide el
 * dispositivo. El equipo de desarrollo app debe declarar en AndroidManifest el
 * permiso USE_FULL_SCREEN_INTENT y crear el canal de notificación con
 * IMPORTANCE_HIGH (fase D en docs/voz/llamadas-voz.md).
 */
export async function sendIncomingCallPush(input: {
  userId: string;
  callId: string;
  jobId: string;
  callerName: string;
  callerRole: "Cliente" | "Trabajador";
}): Promise<void> {
  const title = "Llamada entrante";
  const body = `${input.callerName} te está llamando.`;

  const notificationRef = db.collection("notifications").doc();
  await notificationRef.set({
    userId: input.userId,
    type: "voice_call_incoming",
    title,
    body,
    data: { jobId: input.jobId, callId: input.callId },
    isRead: false,
    readAt: null,
    createdAt: FieldValue.serverTimestamp(),
  });

  await pushToUser(input.userId, {
    data: {
      type: "voice_call_incoming",
      title,
      body,
      callerName: input.callerName,
      callerRole: input.callerRole,
      jobId: input.jobId,
      callId: input.callId,
      direction: "incoming",
    },
    android: { priority: "high", ttl: 60_000 },
  });
}

/**
 * Variante tolerante a fallos para usar DESPUÉS de confirmar una transacción.
 *
 * La notificación es un efecto secundario: si Firestore o FCM fallan, el estado
 * del trabajo/oferta ya quedó guardado. Devolver 500 haría que el cliente crea
 * que la operación falló y reintente, duplicando efectos. Por eso aquí solo se
 * registra el error en logs.
 */
export async function sendNotificationSafely(
  payload: NotificationPayload
): Promise<void> {
  try {
    await createAndSendNotification(payload);
  } catch (error) {
    console.error(
      `No se pudo crear/enviar la notificación (${payload.type} -> ${payload.userId}):`,
      error
    );
  }
}
