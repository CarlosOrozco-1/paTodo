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

export interface NotificationResult {
  notificationId: string;
  pushStatus: "sent" | "no_tokens" | "failed";
}

/**
 * Crea una notificación en Firestore y envía el push por FCM.
 *
 * Uso interno: puede ser llamada directamente por otras Cloud Functions.
 * Uso HTTP: la Cloud Function `sendNotification` la envuelve exponiéndola como endpoint.
 *
 * El envío de FCM está protegido con try/catch para no romper el flujo en el
 * emulador de Firebase (que no emula FCM) ni cuando no hay credenciales válidas.
 *
 * @param {NotificationPayload} payload - Datos de la notificación a crear.
 * @return {Promise<NotificationResult>} ID del documento creado y estado del push.
 */
export async function createAndSendNotification(
  payload: NotificationPayload
): Promise<NotificationResult> {
  // 1. Guardar la notificación en Firestore.
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

  // 2. Buscar los tokens FCM del destinatario.
  const userDoc = await db.collection("users").doc(payload.userId).get();

  if (!userDoc.exists) {
    return { notificationId: notificationRef.id, pushStatus: "no_tokens" };
  }

  const fcmTokens: string[] = userDoc.data()?.fcmTokens ?? [];

  if (fcmTokens.length === 0) {
    return { notificationId: notificationRef.id, pushStatus: "no_tokens" };
  }

  // 3. Enviar el push.
  let pushStatus: NotificationResult["pushStatus"] = "failed";
  try {
    const pushResponse = await messaging.sendEachForMulticast({
      tokens: fcmTokens,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: {
        type: payload.type,
        jobId: payload.data?.jobId ?? "",
        offerId: payload.data?.offerId ?? "",
        conversationId: payload.data?.conversationId ?? "",
      },
    });

    pushStatus = "sent";

    // 4. Limpiar tokens inválidos.
    const invalidTokens: string[] = [];
    pushResponse.responses.forEach((resp, index) => {
      if (!resp.success) {
        const code = resp.error?.code;
        if (
          code === "messaging/invalid-registration-token" ||
          code === "messaging/registration-token-not-registered"
        ) {
          invalidTokens.push(fcmTokens[index]);
        }
      }
    });

    if (invalidTokens.length > 0) {
      await userDoc.ref.update({
        fcmTokens: FieldValue.arrayRemove(...invalidTokens),
      });
    }
  } catch (error) {
    console.error("Error enviando push FCM:", error);
  }

  return { notificationId: notificationRef.id, pushStatus };
}
