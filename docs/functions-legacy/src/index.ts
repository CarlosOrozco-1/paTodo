/**
 * Punto de entrada de las Cloud Functions de PaTodo.
 *
 * Cada exportación registra una función que Firebase despliega.
 * Las funciones se agrupan por dominio en carpetas:
 *   - notifications/  → envío de notificaciones push
 *   - offers/         → aceptación y rechazo de ofertas
 *   - jobs/           → ciclo de vida del trabajo (cancelar, completar)
 *   - reviews/        → creación de reseñas y actualización de reputación
 *   - routes/         → cálculo y almacenamiento de rutas
 *
 * Solo se exponen como HTTP las operaciones críticas que requieren
 * lógica de servidor (transacciones, notificaciones, cálculos externos).
 * El resto de operaciones se realizan directamente desde los clientes
 * (React y Flutter) usando los SDKs de Firebase.
 */

export { acceptOffer } from "./offers/acceptOffer";
export { cancelJob } from "./jobs/cancelJob";
export { completeJob } from "./jobs/completeJob";
export { createReview } from "./reviews/createReview";
export { computeRoute } from "./routes/computeRoute";
export { createUser } from "./users/createUser";
export { onUserCreated } from "./users/onUserCreated";
