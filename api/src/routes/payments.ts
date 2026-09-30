import { Router } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../shared/admin";
import { requireAuth } from "../shared/auth";
import { httpError, handleError } from "../shared/errors";
import { sendNotificationSafely } from "../shared/notifications";

export const paymentsRouter = Router();

const PAYMENT_METHODS = ["demo_card", "demo_cash", "demo_bank"] as const;
const PLATFORM_FEE_PERCENT = 10;

interface CreatePaymentBody {
  jobId: string;
  method?: string;
}

/**
 * POST /createPayment
 *
 * Módulo DEMO/metodológico: simula el resultado final de una pasarela de pagos.
 * No interviene dinero real (isDemo: true). Valida que quien paga sea el cliente
 * dueño, que el trabajo tenga trabajador asignado y que no esté ya pagado.
 * Crea el documento en `payments`, asocia `job.payment` y notifica al trabajador.
 */
paymentsRouter.post("/createPayment", async (request, response) => {
  try {
    const uid = await requireAuth(request);
    const body = request.body as CreatePaymentBody;

    if (!body.jobId) {
      throw httpError(400, "invalid-argument", "Falta el campo jobId.");
    }

    const method = (body.method ?? "demo_card") as string;
    if (!(PAYMENT_METHODS as readonly string[]).includes(method)) {
      throw httpError(
        400,
        "invalid-argument",
        `Método inválido. Usa uno de: ${PAYMENT_METHODS.join(", ")}.`
      );
    }

    const jobRef = db.collection("jobs").doc(body.jobId);

    let workerId = "";
    let jobTitle = "";
    let amount = 0;
    let clientId = "";
    let paymentId = "";

    await db.runTransaction(async (transaction) => {
      // ============ LECTURAS ============
      const jobDoc = await transaction.get(jobRef);
      if (!jobDoc.exists) {
        throw httpError(404, "not-found", "El trabajo no existe.");
      }

      const jobData = jobDoc.data()!;
      clientId = jobData.clientId;
      workerId = jobData.workerId;
      jobTitle = jobData.details?.title ?? "Trabajo";

      if (clientId !== uid) {
        throw httpError(
          403,
          "permission-denied",
          "Solo el cliente dueño puede pagar el trabajo."
        );
      }

      if (!workerId || !["accepted", "in_progress", "completed"].includes(jobData.status)) {
        throw httpError(
          412,
          "failed-precondition",
          `El trabajo debe tener trabajador asignado para pagarse (estado: ${jobData.status ?? "sin asignar"}).`
        );
      }

      if (jobData.payment?.status === "paid") {
        throw httpError(
          409,
          "already-exists",
          "El trabajo ya fue pagado."
        );
      }

      // Monto = precio de la oferta aceptada (si existe) o el propuesto del cliente.
      amount = Number(jobData.pricing?.proposedPrice ?? 0);
      if (jobData.acceptedOfferId) {
        const offerDoc = await transaction.get(
          db.collection("offers").doc(jobData.acceptedOfferId)
        );
        if (offerDoc.exists && typeof offerDoc.data()?.price === "number") {
          amount = offerDoc.data()!.price;
        }
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        throw httpError(412, "failed-precondition", "El trabajo no tiene un monto válido para cobrar.");
      }

      // ============ ESCRITURAS ============
      const platformFee = Math.round(amount * (PLATFORM_FEE_PERCENT / 100) * 100) / 100;
      const workerPayout = Math.round((amount - platformFee) * 100) / 100;

      const paymentRef = db.collection("payments").doc();
      paymentId = paymentRef.id;
      transaction.set(paymentRef, {
        jobId: body.jobId,
        clientId,
        workerId,
        amount,
        currency: jobData.pricing?.currency ?? "GTQ",
        method,
        isDemo: true,
        feePercent: PLATFORM_FEE_PERCENT,
        platformFee,
        workerPayout,
        status: "paid",
        paidAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      transaction.update(jobRef, {
        "payment.paymentId": paymentId,
        "payment.status": "paid",
        "payment.amount": amount,
        "payment.currency": jobData.pricing?.currency ?? "GTQ",
        "payment.method": method,
        "payment.platformFee": platformFee,
        "payment.workerPayout": workerPayout,
        "payment.paidAt": FieldValue.serverTimestamp(),
        "payment.isDemo": true,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    await sendNotificationSafely({
      userId: workerId,
      type: "payment_received",
      title: "Pago recibido",
      body: `Recibiste el pago por "${jobTitle}" (${method === "demo_cash" ? "efectivo" : method === "demo_bank" ? "transferencia" : "tarjeta"}, demo).`,
      data: { jobId: body.jobId },
    });

    const paymentDoc = await db.collection("payments").doc(paymentId).get();
    response.status(201).json({ id: paymentDoc.id, ...paymentDoc.data() });
  } catch (error) {
    handleError(error, response);
  }
});