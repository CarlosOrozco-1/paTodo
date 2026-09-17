import express from "express";
import cors from "cors";
import { offersRouter } from "./routes/offers";
import { jobsRouter } from "./routes/jobs";
import { reviewsRouter } from "./routes/reviews";
import { routesRouter } from "./routes/routes";

const app = express();

app.use(cors());
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

// Manejo de rutas no encontradas.
app.use((_req, res) => {
  res.status(404).json({ error: "Ruta no encontrada.", code: "not-found" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
