import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import type { UpdateUserDto, User } from '@/types/user.types';
import type { PaginatedResponse, QueryParams } from '@/types/common.types';
import type { BackendUser } from '../mappers';
import { mapUser, toPageArray } from '../mappers';
import { NotSupportedError } from '.';
import { auth, db } from '../firebase/init';
import { ensureBackendUser, requireUid, userFromData } from '../firebase/fs';
import { encodeGeohash } from '../firebase/geohash';

async function current(): Promise<User> {
  const uid = requireUid();
  const email = auth.currentUser?.email ?? '';
  return mapUser(await ensureBackendUser(uid, email));
}

async function getUid(uid: string) {
  return getDoc(doc(db, 'users', uid));
}

export const realUsers = {
  async getById(id: string): Promise<User> {
    try {
      const snapshot = await getUid(id);
      if (!snapshot.exists()) throw new Error('Usuario no encontrado');
      return mapUser(userFromData({ ...snapshot.data(), id: snapshot.id })!);
    } catch {
      throw new Error('No se puede ver ese perfil');
    }
  },

  /**
   * Observa un perfil en tiempo real.
   *
   * Sin esto, el estado "en línea" de un profesional solo se vería al abrir el
   * perfil: si lo cambiaba en su propio panel, quien lo estuviera viendo se
   * quedaría con el valor viejo hasta recargar.
   */
  subscribe(id: string, onData: (user: User) => void, onError?: (error: Error) => void): () => void {
    return onSnapshot(
      doc(db, 'users', id),
      (snapshot) => {
        if (!snapshot.exists()) {
          onError?.(new Error('Usuario no encontrado'));
          return;
        }
        const user = userFromData({ ...snapshot.data(), id: snapshot.id });
        if (user) onData(mapUser(user));
      },
      (error) => onError?.(error),
    );
  },

  async getMe(): Promise<User> {
    return current();
  },

  async updateMe(data: UpdateUserDto): Promise<User> {
    const uid = requireUid();
    const patch: Record<string, unknown> = {};

    if (data.profile && Object.values(data.profile).some((v) => v !== undefined)) {
      patch.profile = {
        firstName: data.profile.firstName ?? '',
        lastName: data.profile.lastName ?? '',
        avatarUrl: data.profile.avatarUrl ?? null,
        bio: data.profile.bio ?? null,
      };
    }

    if (data.contact && Object.values(data.contact).some((v) => v !== undefined)) {
      patch.contact = {
        phone: data.contact.phone ?? '',
        alternatePhone: data.contact.alternatePhone ?? null,
        address: data.contact.address ?? null,
      };
    }

    if (data.location && data.location.coordinates?.length === 2) {
      const [longitude, latitude] = data.location.coordinates;
      patch.location = {
        geopoint: { latitude, longitude },
        geohash: encodeGeohash(latitude, longitude, 9),
      };
    }

    if (data.skillIds !== undefined) {
      patch.skills = data.skillIds;
    }

    if (data.availability !== undefined) {
      const availability: Record<string, unknown> = {};
      if (data.availability.isOnline !== undefined) availability.isOnline = data.availability.isOnline;
      if (data.availability.workingHours !== undefined) availability.workingHours = data.availability.workingHours;
      if (data.availability.serviceArea !== undefined) {
        availability.serviceArea = { radiusKm: data.availability.serviceArea.radiusKm ?? 10 };
      }
      if (Object.keys(availability).length > 0) patch.availability = availability;
    }

    if (Object.keys(patch).length > 0) {
      patch.updatedAt = serverTimestamp();
      await updateDoc(doc(db, 'users', uid), patch);
    }
    return current();
  },

  async update(): Promise<User> {
    throw new NotSupportedError('Editar otro usuario no está disponible');
  },

  async getAll(params?: QueryParams): Promise<PaginatedResponse<User>> {
    if (params?.role !== undefined && params.role !== 'all') {
      return realUsers.getByRole(params.role as string);
    }
    throw new NotSupportedError('Listar usuarios del sistema no está disponible en este backend');
  },

  async getByRole(role: string): Promise<PaginatedResponse<User>> {
    const snapshot = await getDocs(query(collection(db, 'users'), where('role', '==', role)));
    const items = snapshot.docs
      .map((item) => userFromData({ ...item.data(), id: item.id }))
      .filter((item): item is BackendUser => item !== null)
      .map(mapUser);
    return toPageArray(items);
  },
};