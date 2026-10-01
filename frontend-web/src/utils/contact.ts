/**
 * Un alta con Google nunca entrega `phoneNumber` (esa propiedad solo existe si
 * la cuenta de Google tiene un teléfono), así que el documento nace con
 * `contact.phone` vacío. Estas funciones son la única fuente de verdad sobre
 * "este usuario todavía no dio su teléfono", para que el onboarding y la
 * aplicación no decidan el tema por su cuenta.
 */

/** `true` cuando el teléfono falta o es solo espacios. */
export function isPhoneMissing(phone: string | null | undefined): boolean {
  return !phone || phone.trim().length === 0;
}

/**
 * Normaliza a un formato comparable sin tocar cómo se guarda: quitamos
 * espacios y separadores habituales de teléfono, conservando el `+` inicial.
 */
export function normalizePhone(phone: string): string {
  return phone.trim().replace(/(?!^)\s+/g, '');
}

/**
 * Valida un teléfono de Guatemala o internacional. Acepta 8 dígitos (Guatemala,
 * con prefijo opcional) o formato internacional `+` seguido de 8-15 dígitos.
 * Rechaza letras y símbolos, que es el error típico al teclear.
 */
export function isValidPhone(phone: string): boolean {
  const compact = normalizePhone(phone).replace(/[\s()-]/g, '');
  const gtLocal = /^\d{8}$/;
  const international = /^\+\d{8,15}$/;
  const internationalNoPlus = /^\d{8,15}$/;
  return gtLocal.test(compact) || international.test(compact) || internationalNoPlus.test(compact);
}
