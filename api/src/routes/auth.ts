import { Router } from "express";
import crypto from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { auth, db } from "../shared/admin";
import { httpError, handleError } from "../shared/errors";

export const authRouter = Router();

function getEmailHash(email: string): string {
  return crypto.createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

function hashOtp(email: string, code: string): string {
  return crypto
    .createHash("sha256")
    .update(`${email.trim().toLowerCase()}:${code.trim()}`)
    .digest("hex");
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_REGEX = /^[0-9]{6}$/;

/**
 * Envía el código de recuperación mediante el servicio de correo Resend.
 * Si RESEND_API_KEY no está configurada (ej. entorno de desarrollo local),
 * imprime el código en la consola del servidor para permitir pruebas sin fricción.
 */
async function sendRecoveryEmail(email: string, code: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim() || "PaTodo <onboarding@resend.dev>";

  if (!apiKey) {
    console.log("\n=======================================================");
    console.log(`[DEV OTP RECOVERY] Correo: ${email} | Código: ${code}`);
    console.log("[DEV NOTE] Configura RESEND_API_KEY en api/.env para envío de correos reales.");
    console.log("=======================================================\n");
    return true;
  }

  const htmlContent = `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="utf-8">
    <title>Código de recuperación - PaTodo</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 24px; color: #1f2937; }
      .container { max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 20px; padding: 32px; box-shadow: 0 4px 14px rgba(0,0,0,0.06); }
      .brand { font-size: 28px; font-weight: 800; color: #00A86B; text-align: center; letter-spacing: -0.5px; }
      .title { font-size: 20px; font-weight: 700; color: #111827; text-align: center; margin: 16px 0 8px; }
      .subtitle { font-size: 14px; color: #4b5563; text-align: center; line-height: 1.5; margin-bottom: 24px; }
      .code-container { background: #f0fdf4; border: 2px dashed #00A86B; border-radius: 14px; padding: 20px; text-align: center; margin: 24px 0; }
      .code { font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #00A86B; font-family: 'Courier New', monospace; margin-left: 10px; }
      .notice { font-size: 13px; color: #6b7280; line-height: 1.5; margin-bottom: 20px; }
      .security { background: #f9fafb; border-radius: 10px; padding: 12px 16px; font-size: 12px; color: #6b7280; }
      .footer { font-size: 11px; color: #9ca3af; text-align: center; margin-top: 28px; border-top: 1px solid #f3f4f6; padding-top: 16px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="brand">PaTodo</div>
      <h2 class="title">Recuperación de contraseña</h2>
      <p class="subtitle">Recibimos una solicitud para restablecer la contraseña de tu cuenta. Ingresa el siguiente código en la app:</p>
      <div class="code-container">
        <div class="code">${code}</div>
      </div>
      <p class="notice">Este código es de un solo uso y caduca en <strong>15 minutos</strong>.</p>
      <div class="security">
        🔒 <strong>¿No solicitaste este cambio?</strong> Si no realizaste esta solicitud, puedes ignorar este mensaje con total seguridad. Tu contraseña actual no se modificará.
      </div>
      <div class="footer">
        &copy; ${new Date().getFullYear()} PaTodo. Plataforma de servicios bajo demanda.
      </div>
    </div>
  </body>
  </html>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: `Tu código de recuperación de PaTodo: ${code}`,
        html: htmlContent,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Resend API error:", res.status, errText);
      // Registramos en log como respaldo para no bloquear al usuario en pruebas
      console.log(`[BACKUP OTP LOG] Código para ${email}: ${code}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Error conectando con Resend:", error);
    console.log(`[BACKUP OTP LOG] Código para ${email}: ${code}`);
    return false;
  }
}

/**
 * POST /auth/requestPasswordReset
 *
 * Solicita el restablecimiento de contraseña mediante un código de 6 dígitos enviado por email.
 */
authRouter.post("/auth/requestPasswordReset", async (req, res) => {
  try {
    const { email } = req.body ?? {};

    if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
      throw httpError(400, "invalid-argument", "Ingresa un correo electrónico válido.");
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailHash = getEmailHash(normalizedEmail);

    // 1. Verificar si el usuario existe en Firebase Auth sin revelar detalles al cliente
    try {
      await auth.getUserByEmail(normalizedEmail);
    } catch (err: any) {
      if (err.code === "auth/user-not-found") {
        // Respuesta genérica por seguridad para evitar enumeración de correos
        res.status(200).json({
          message: "Si el correo está registrado, enviamos un código de verificación.",
        });
        return;
      }
      throw err;
    }

    // 2. Control de frecuencia (rate limit): máximo 1 código cada 60 segundos por correo
    const resetDocRef = db.collection("passwordResets").doc(emailHash);
    const existingSnap = await resetDocRef.get();
    const now = Date.now();

    if (existingSnap.exists) {
      const data = existingSnap.data()!;
      const createdAtMs = data.createdAt?.toMillis ? data.createdAt.toMillis() : (data.createdAtMs ?? 0);
      if (now - createdAtMs < 60_000) {
        throw httpError(
          429,
          "resource-exhausted",
          "Por favor espera un minuto antes de solicitar un nuevo código."
        );
      }
    }

    // 3. Generar código OTP de 6 dígitos numéricos
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = now + 15 * 60 * 1000; // 15 minutos

    // 4. Guardar hash del código en Firestore
    await resetDocRef.set({
      email: normalizedEmail,
      hashedCode: hashOtp(normalizedEmail, code),
      expiresAt,
      attempts: 0,
      maxAttempts: 5,
      createdAtMs: now,
      createdAt: FieldValue.serverTimestamp(),
    });

    // 5. Enviar el correo mediante Resend
    await sendRecoveryEmail(normalizedEmail, code);

    res.status(200).json({
      message: "Si el correo está registrado, enviamos un código de verificación.",
    });
  } catch (error) {
    handleError(error, res);
  }
});

/**
 * POST /auth/verifyResetCode
 *
 * Valida si el código de 6 dígitos ingresado es correcto y vigente.
 */
authRouter.post("/auth/verifyResetCode", async (req, res) => {
  try {
    const { email, code } = req.body ?? {};

    if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
      throw httpError(400, "invalid-argument", "Ingresa un correo electrónico válido.");
    }

    if (!code || typeof code !== "string" || !CODE_REGEX.test(code.trim())) {
      throw httpError(400, "invalid-argument", "El código debe ser de 6 dígitos numéricos.");
    }

    const normalizedEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();
    const emailHash = getEmailHash(normalizedEmail);
    const resetDocRef = db.collection("passwordResets").doc(emailHash);
    const snap = await resetDocRef.get();

    if (!snap.exists) {
      throw httpError(400, "invalid-argument", "Código inválido o expirado. Solicita uno nuevo.");
    }

    const data = snap.data()!;
    const now = Date.now();

    // Comprobar expiración
    if (data.expiresAt < now) {
      await resetDocRef.delete();
      throw httpError(400, "invalid-argument", "El código ha expirado. Solicita uno nuevo.");
    }

    // Comprobar intentos fallidos
    if (data.attempts >= (data.maxAttempts ?? 5)) {
      await resetDocRef.delete();
      throw httpError(
        429,
        "resource-exhausted",
        "Has superado el límite de intentos permitidos. Solicita un nuevo código."
      );
    }

    // Comprobar coincidencia del código
    const expectedHash = hashOtp(normalizedEmail, cleanCode);
    if (data.hashedCode !== expectedHash) {
      await resetDocRef.update({
        attempts: FieldValue.increment(1),
      });
      throw httpError(400, "invalid-argument", "Código incorrecto. Verifica e inténtalo de nuevo.");
    }

    res.status(200).json({
      valid: true,
      message: "Código verificado correctamente.",
    });
  } catch (error) {
    handleError(error, res);
  }
});

/**
 * POST /auth/resetPassword
 *
 * Restablece la contraseña del usuario en Firebase Auth tras validar el código.
 */
authRouter.post("/auth/resetPassword", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body ?? {};

    if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
      throw httpError(400, "invalid-argument", "Ingresa un correo electrónico válido.");
    }

    if (!code || typeof code !== "string" || !CODE_REGEX.test(code.trim())) {
      throw httpError(400, "invalid-argument", "El código debe tener 6 dígitos numéricos.");
    }

    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
      throw httpError(400, "invalid-argument", "La nueva contraseña debe tener al menos 8 caracteres.");
    }

    const normalizedEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();
    const emailHash = getEmailHash(normalizedEmail);
    const resetDocRef = db.collection("passwordResets").doc(emailHash);
    const snap = await resetDocRef.get();

    if (!snap.exists) {
      throw httpError(400, "invalid-argument", "Código inválido o expirado. Solicita uno nuevo.");
    }

    const data = snap.data()!;
    const now = Date.now();

    if (data.expiresAt < now) {
      await resetDocRef.delete();
      throw httpError(400, "invalid-argument", "El código ha expirado. Solicita uno nuevo.");
    }

    if (data.attempts >= (data.maxAttempts ?? 5)) {
      await resetDocRef.delete();
      throw httpError(
        429,
        "resource-exhausted",
        "Has superado el límite de intentos permitidos. Solicita un nuevo código."
      );
    }

    const expectedHash = hashOtp(normalizedEmail, cleanCode);
    if (data.hashedCode !== expectedHash) {
      await resetDocRef.update({
        attempts: FieldValue.increment(1),
      });
      throw httpError(400, "invalid-argument", "Código incorrecto. Verifica e inténtalo de nuevo.");
    }

    // 1. Obtener usuario en Firebase Auth
    const userRecord = await auth.getUserByEmail(normalizedEmail);

    // 2. Actualizar contraseña
    await auth.updateUser(userRecord.uid, {
      password: newPassword,
    });

    // 3. Revocar sesiones anteriores
    try {
      await auth.revokeRefreshTokens(userRecord.uid);
    } catch (e) {
      // No bloqueante
    }

    // 4. Invalida y elimina el código usado
    await resetDocRef.delete();

    res.status(200).json({
      message: "Contraseña actualizada exitosamente.",
    });
  } catch (error) {
    handleError(error, res);
  }
});
