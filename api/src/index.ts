import express from "express";
import cors from "cors";
import { offersRouter } from "./routes/offers";
import { jobsRouter } from "./routes/jobs";
import { reviewsRouter } from "./routes/reviews";
import { routesRouter } from "./routes/routes";
import userRouter from "./routes/user";


const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

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

app.use(express.json());

// Health check.
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
