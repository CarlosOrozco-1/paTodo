import { FieldValue } from "firebase-admin/firestore";
import { db, messaging } from "./admin";

export type NotificationType =
  | "new_offer"
  | "offer_accepted"
  | "offer_rejected"
  | "new_message"
  | "job_started"
  | "job_completed"
  | "job_cancelled"
  | "new_review";

export interface NotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: {
    jobId?: string;
    offerId?: string;
    conversationId?: string;
  };
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

  const userDoc = await db.collection("users").doc(payload.userId).get();

  if (!userDoc.exists) return notificationRef.id;

  const fcmTokens: string[] = userDoc.data()?.fcmTokens ?? [];
  if (fcmTokens.length === 0) return notificationRef.id;

  const pushResponse = await messaging.sendEachForMulticast({
    tokens: fcmTokens,
    notification: { title: payload.title, body: payload.body },
    data: {
      type: payload.type,
      jobId: payload.data?.jobId ?? "",
      offerId: payload.data?.offerId ?? "",
      conversationId: payload.data?.conversationId ?? "",
    },
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

  return notificationRef.id;
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
