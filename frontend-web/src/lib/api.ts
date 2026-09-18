import type { User } from "firebase/auth";

export const API_URL: string = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:3000";

export interface ApiError {
  code: string;
  message: string;
}

/** Obtiene un idToken fresco (el role claim solo viaja en tokens nuevos). */
export async function getFreshToken(user: User | null): Promise<string> {
  if (!user) return "";
  // getIdToken(true) fuerza refresco: necesario tras /createUser (Custom Claim role).
  return user.getIdToken(true);
}

/**
 * Cliente HTTP mínimo para la API REST transaccional.
 * Todos los endpoints (excepto GET /) requieren el token de Firebase Auth.
 */
export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  /** POST con JSON. Autentica con el idToken del usuario. */
  async post<T>(path: string, body: unknown, token: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    return this.handle<T>(res);
  }

  private async handle<T>(res: Response): Promise<T> {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = data as Partial<ApiError>;
      throw new Error(err.message || `HTTP ${res.status}`);
    }
    return data as T;
  }
}

export const apiClient = new ApiClient();