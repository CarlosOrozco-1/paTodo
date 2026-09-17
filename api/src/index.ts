// Carga api/.env antes que cualquier módulo que lea variables de entorno.
import "dotenv/config";

import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { offersRouter } from "./routes/offers";
import { jobsRouter } from "./routes/jobs";
import { reviewsRouter } from "./routes/reviews";
import { routesRouter } from "./routes/routes";
import userRouter from "./routes/user";
import { handleError } from "./shared/errors";

const app = express();

// Detrás del proxy de Render, para que req.ip sea la IP real del cliente.
app.set("trust proxy", process.env.TRUST_PROXY === "false" ? false : 1);

const allowedOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (allowedOrigins.length === 0) {
  console.warn(
    "⚠️  CORS_ORIGINS está vacío: ningún navegador podrá llamar a la API " +
      "(curl/Postman sí, porque no envían header Origin). Define los dominios de los frontends."
  );
}

app.use(
  cors({
    // Política de CORS por allowlist.
    // - Sin header Origin (curl, Postman, BFF) -> se permite.
    // - Origin en la lista -> se permite y se devuelve Access-Control-Allow-Origin.
    // - Origin fuera de la lista -> callback(null, false): NO es un error del
    //   servidor, es una política de seguridad. El middleware simplemente no
    //   agrega headers CORS y el navegador bloquea la respuesta del origen no permitido.
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      return callback(null, allowedOrigins.includes(origin));
    },
    credentials: true,
  })
);

// ===================== Rate limiting =====================
// Límite simple en memoria por IP (ventana fija). Suficiente para una sola
// instancia; si algún día se escala horizontalmente, mover a un store compartido.
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX ?? 120);
const requestLog = new Map<string, { count: number; resetAt: number }>();

function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();

  if (requestLog.size > 10_000) {
    for (const [key, entry] of requestLog) {
      if (entry.resetAt <= now) requestLog.delete(key);
    }
  }

  const key = req.ip ?? "unknown";
  const entry = requestLog.get(key);

  if (!entry || entry.resetAt <= now) {
    requestLog.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    next();
    return;
  }

  entry.count += 1;
  if (entry.count > RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    res.setHeader("Retry-After", String(retryAfter));
    res.status(429).json({
      error: "Demasiadas solicitudes. Intenta de nuevo más tarde.",
      code: "resource-exhausted",
    });
    return;
  }

  next();
}

app.use(rateLimit);

// El límite por defecto (100kb) evita cuerpos desmesurados.
app.use(express.json({ limit: "100kb" }));

// Health check (exento de rate limiting no, pero es barato).
app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "patodo-api" });
});

// Rutas.
app.use(offersRouter);
app.use(jobsRouter);
app.use(reviewsRouter);
app.use(routesRouter);
app.use(userRouter);

// Manejo de rutas no encontradas.
app.use((_req, res) => {
  res.status(404).json({ error: "Ruta no encontrada.", code: "not-found" });
});

// Manejo centralizado de errores: mantiene el contrato { error, code } incluso
// para fallos que lanza Express antes de llegar a las rutas (JSON malformado,
// cuerpo demasiado grande).
app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const type = (error as { type?: string })?.type;

  if (type === "entity.parse.failed") {
    res
      .status(400)
      .json({
        error: "El cuerpo de la solicitud no es JSON válido.",
        code: "invalid-argument",
      });
    return;
  }

  if (type === "entity.too.large") {
    res
      .status(413)
      .json({
        error: "El cuerpo de la solicitud es demasiado grande.",
        code: "invalid-argument",
      });
    return;
  }

  handleError(error, res);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
