import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { Router } from "express";

import { db } from "../shared/admin";
import { requireAuth } from "../shared/auth";
import { httpError, handleError } from "../shared/errors";
import { sendNotificationSafely } from "../shared/notifications";

export const messagesRouter = Router();

interface SendMessageBody {
  conversationId?: string;
  content?: string;
}

function displayNameOf(user: Record<string, unknown>): string {
  const profile =
    user.profile && typeof user.profile === "object"
      ? (user.profile as Record<string, unknown>)
      : {};
  const first = String(profile.firstName ?? user.firstName ?? "").trim();
  const last = String(profile.lastName ?? user.lastName ?? "").trim();
  const fullName = `${first} ${last}`.trim();
  if (fullName) return fullName;
  for (const candidate of [profile.fullName, profile.name, user.displayName, user.name]) {
    const value = typeof candidate === "string" ? candidate.trim() : "";
    if (value) return value;
  }
  return "Tu contacto";
}

function notificationPreview(content: string): string {
  const limit = 160;
  return content.length <= limit ? content : `${content.slice(0, limit - 1)}…`;
}

/**
 * POST /sendMessage
 *
 * Escribir por la API mantiene un único flujo para el mensaje y su aviso push.
 * Solo el cliente y el trabajador asignado del trabajo pueden escribir en una
 * conversación activa; ni el ID de emisor ni el destinatario vienen del móvil.
 */
messagesRouter.post("/sendMessage", async (request, response) => {
  try {
    const uid = await requireAuth(request);
    const body = request.body as SendMessageBody;
    const conversationId = body?.conversationId?.trim() ?? "";
    const content = body?.content?.trim() ?? "";

    if (!conversationId || !content) {
      throw httpError(400, "invalid-argument", "Faltan conversationId o contenido.");
    }
    if (content.length > 2000) {
      throw httpError(400, "invalid-argument", "El mensaje es demasiado largo.");
    }

    const conversationRef = db.collection("conversations").doc(conversationId);
    const messageRef = conversationRef.collection("messages").doc();
    let recipientId = "";
    let jobId = "";
    let senderName = "Tu contacto";

    await db.runTransaction(async (transaction) => {
      const conversationDoc = await transaction.get(conversationRef);
      if (!conversationDoc.exists) {
        throw httpError(404, "not-found", "La conversación no existe.");
      }

      const conversation = conversationDoc.data() ?? {};
      if (conversation.status !== "active") {
        throw httpError(412, "failed-precondition", "Esta conversación ya no está activa.");
      }
      if (!Array.isArray(conversation.participants) || !conversation.participants.includes(uid)) {
        throw httpError(403, "permission-denied", "No puedes enviar mensajes en esta conversación.");
      }
      if (typeof conversation.jobId !== "string" || conversation.jobId === "") {
        throw httpError(412, "failed-precondition", "La conversación no está vinculada a un servicio válido.");
      }

      const jobDoc = await transaction.get(db.collection("jobs").doc(conversation.jobId));
      if (!jobDoc.exists) {
        throw httpError(404, "not-found", "El servicio asociado no existe.");
      }
      const job = jobDoc.data() ?? {};
      if (job.status !== "accepted" && job.status !== "in_progress") {
        throw httpError(412, "failed-precondition", "Este servicio ya no permite mensajes.");
      }
      if (uid !== job.clientId && uid !== job.workerId) {
        throw httpError(403, "permission-denied", "No participas en este servicio.");
      }

      recipientId = uid === job.clientId ? job.workerId : job.clientId;
      if (typeof recipientId !== "string" || recipientId === "") {
        throw httpError(412, "failed-precondition", "El servicio todavía no tiene ambas partes asignadas.");
      }
      jobId = conversation.jobId;

      const senderDoc = await transaction.get(db.collection("users").doc(uid));
      senderName = displayNameOf(senderDoc.data() ?? {});

      transaction.set(messageRef, {
        senderId: uid,
        content,
        type: "text",
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.update(conversationRef, {
        lastMessage: {
          content,
          senderId: uid,
          createdAt: FieldValue.serverTimestamp(),
        },
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    await sendNotificationSafely({
      userId: recipientId,
      type: "new_message",
      title: `${senderName} te envio un mensaje`,
      body: notificationPreview(content),
      data: {
        conversationId,
        jobId,
        senderName,
        messagePreview: notificationPreview(content),
      },
    });

    const message = await messageRef.get();
    const createdAt = message.data()?.createdAt;
    response.status(201).json({
      id: messageRef.id,
      conversationId,
      senderId: uid,
      content,
      type: "text",
      createdAt:
        createdAt instanceof Timestamp ? createdAt.toDate().toISOString() : null,
    });
  } catch (error) {
    handleError(error, response);
  }
});
