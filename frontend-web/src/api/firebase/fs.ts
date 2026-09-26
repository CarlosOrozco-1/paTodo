import {
  Timestamp,
  type DocumentData,
  type DocumentSnapshot,
  doc,
  getDoc,
} from 'firebase/firestore';
import type {
  BackendCategory,
  BackendConversation,
  BackendJob,
  BackendMessage,
  BackendNotification,
  BackendOffer,
  BackendReview,
  BackendSkill,
  BackendUser,
} from '../mappers';
import { auth, db } from './init';

type Any = Record<string, unknown>;

export function toIso(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return new Date().toISOString();
  }
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object') {
    const obj = value as Any;
    if (typeof obj._seconds === 'number' && typeof obj._nanoseconds === 'number') {
      return new Date(
        obj._seconds * 1000 + Math.round(obj._nanoseconds / 1000000),
      ).toISOString();
    }
  }
  return new Date().toISOString();
}

export function toIsoOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return toIso(value);
}

export function currentUid(): string | null {
  return auth.currentUser?.uid ?? null;
}

export function requireUid(): string {
  const uid = currentUid();
  if (!uid) throw new Error('Sesión no válida. Vuelve a iniciar sesión.');
  return uid;
}

function pointToCoords(geo: unknown): [number, number] | null {
  if (geo && typeof geo === 'object') {
    const g = geo as Any;
    if (typeof g.longitude === 'number' && typeof g.latitude === 'number') {
      const longitude = g.longitude;
      const latitude = g.latitude;
      if (Number.isFinite(longitude) && Number.isFinite(latitude)) {
        return [longitude, latitude];
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------

export function userFromData(data: Any): BackendUser | null {
  if (!data) return null;
  const profile = (data.profile ?? {}) as Any;
  const contact = (data.contact ?? {}) as Any;
  const stats = (data.stats ?? {}) as Any;
  const availability = (data.availability ?? {}) as Any;
  const coords = pointToCoords((data.location as Any | undefined)?.geopoint);
  return {
    id: typeof data.id === 'string' ? data.id : '',
    email: typeof data.email === 'string' ? data.email : '',
    role: typeof data.role === 'string' ? data.role : 'client',
    firstName: typeof profile.firstName === 'string' ? profile.firstName : '',
    lastName: typeof profile.lastName === 'string' ? profile.lastName : '',
    avatarUrl:
      typeof profile.avatarUrl === 'string' && profile.avatarUrl ? profile.avatarUrl : undefined,
    bio: typeof profile.bio === 'string' && profile.bio ? profile.bio : undefined,
    phone: typeof contact.phone === 'string' ? contact.phone : '',
    skillIds: Array.isArray(data.skills) ? (data.skills as string[]) : [],
    rating: typeof stats.rating === 'number' ? stats.rating : 0,
    ratingCount: typeof stats.ratingCount === 'number' ? stats.ratingCount : 0,
    completedJobs: typeof stats.completedJobs === 'number' ? stats.completedJobs : 0,
    online: availability?.isOnline === true,
    verified: true,
    coordinates: coords,
    createdAt: data.createdAt ? toIso(data.createdAt) : undefined,
    updatedAt: data.updatedAt ? toIso(data.updatedAt) : new Date().toISOString(),
  };
}

export function userFromDoc(snapshot: DocumentSnapshot<DocumentData>): BackendUser | null {
  const data = snapshot.data();
  if (!data) return null;
  return userFromData({ ...data, id: snapshot.id });
}

// ---------------------------------------------------------------------------
// jobs
// ---------------------------------------------------------------------------

export function jobFromData(data: Any): BackendJob | null {
  if (!data) return null;
  const details = (data.details ?? {}) as Any;
  const loc = (data.location ?? {}) as Any;
  const pricing = (data.pricing ?? {}) as Any;
  const coords = pointToCoords(loc.geopoint) ?? (loc.coordinates as [number, number] | undefined) ?? null;
  return {
    id: typeof data.id === 'string' ? data.id : '',
    clientId: typeof data.clientId === 'string' ? data.clientId : '',
    workerId: typeof data.workerId === 'string' ? data.workerId : undefined,
    status: typeof data.status === 'string' ? data.status : 'pending',
    acceptedOfferId:
      typeof data.acceptedOfferId === 'string' ? data.acceptedOfferId : undefined,
    scheduledFor: toIsoOrNull(data.scheduledFor),
    startedAt: toIsoOrNull(data.startedAt),
    completedAt: toIsoOrNull(data.completedAt),
    cancelledAt: toIsoOrNull(data.cancelledAt),
    cancellationReason:
      typeof data.cancelReason === 'string'
        ? data.cancelReason
        : typeof data.cancellationReason === 'string'
          ? data.cancellationReason
          : null,
    createdAt: data.createdAt ? toIso(data.createdAt) : new Date().toISOString(),
    updatedAt: data.updatedAt ? toIso(data.updatedAt) : new Date().toISOString(),
    details: {
      title: typeof details.title === 'string' ? details.title : '',
      description: typeof details.description === 'string' ? details.description : '',
      categoryId: typeof details.categoryId === 'string' ? details.categoryId : '',
      skillIds: Array.isArray(details.skillIds) ? (details.skillIds as string[]) : [],
    },
    location: {
      type: 'Point',
      coordinates: (coords ?? [0, 0]) as [number, number],
      address: typeof loc.address === 'string' ? loc.address : '',
      placeId: typeof loc.placeId === 'string' ? loc.placeId : undefined,
    },
    pricing: {
      proposedPrice: typeof pricing.proposedPrice === 'number' ? pricing.proposedPrice : 0,
      currency: typeof pricing.currency === 'string' ? pricing.currency : 'GTQ',
      priceType: typeof pricing.priceType === 'string' ? pricing.priceType : 'fixed',
    },
  };
}

export function jobFromDoc(snapshot: DocumentSnapshot<DocumentData>): BackendJob | null {
  const data = snapshot.data();
  if (!data) return null;
  return jobFromData({ ...data, id: snapshot.id });
}

// ---------------------------------------------------------------------------
// offers
// ---------------------------------------------------------------------------

export function offerFromData(data: Any): BackendOffer | null {
  if (!data) return null;
  const snapshot = (data.workerSnapshot ?? {}) as Any;
  return {
    id: typeof data.id === 'string' ? data.id : '',
    jobId: typeof data.jobId === 'string' ? data.jobId : '',
    workerId: typeof data.workerId === 'string' ? data.workerId : '',
    workerSnapshot: {
      name: typeof snapshot.name === 'string' ? snapshot.name : '',
      rating: typeof snapshot.rating === 'number' ? snapshot.rating : 0,
      completedJobs: typeof snapshot.completedJobs === 'number' ? snapshot.completedJobs : 0,
      avatarUrl:
        typeof snapshot.avatarUrl === 'string' && snapshot.avatarUrl
          ? snapshot.avatarUrl
          : undefined,
    },
    price: typeof data.price === 'number' ? data.price : 0,
    currency: typeof data.currency === 'string' ? data.currency : 'GTQ',
    estimatedTime: typeof data.estimatedTime === 'number' ? data.estimatedTime : 0,
    message: typeof data.message === 'string' ? data.message : undefined,
    status: typeof data.status === 'string' ? data.status : 'pending',
    expiresAt: toIsoOrNull(data.expiresAt),
    createdAt: data.createdAt ? toIso(data.createdAt) : new Date().toISOString(),
    updatedAt: data.updatedAt ? toIso(data.updatedAt) : new Date().toISOString(),
  };
}

export function offerFromDoc(snapshot: DocumentSnapshot<DocumentData>): BackendOffer | null {
  const data = snapshot.data();
  if (!data) return null;
  return offerFromData({ ...data, id: snapshot.id });
}

// ---------------------------------------------------------------------------
// reviews
// ---------------------------------------------------------------------------

export function reviewFromData(data: Any): BackendReview | null {
  if (!data) return null;
  return {
    id: typeof data.id === 'string' ? data.id : '',
    jobId: typeof data.jobId === 'string' ? data.jobId : '',
    reviewerId: typeof data.reviewerId === 'string' ? data.reviewerId : '',
    revieweeId: typeof data.revieweeId === 'string' ? data.revieweeId : '',
    rating: typeof data.rating === 'number' ? data.rating : 0,
    comment: typeof data.comment === 'string' && data.comment ? data.comment : undefined,
    aspects: null,
    isPublic: true,
    response: null,
    createdAt: data.createdAt ? toIso(data.createdAt) : new Date().toISOString(),
    updatedAt: data.updatedAt ? toIso(data.updatedAt) : new Date().toISOString(),
  };
}

export function reviewFromDoc(snapshot: DocumentSnapshot<DocumentData>): BackendReview | null {
  const data = snapshot.data();
  if (!data) return null;
  return reviewFromData({ ...data, id: snapshot.id });
}

// ---------------------------------------------------------------------------
// conversations / messages
// ---------------------------------------------------------------------------

export function conversationFromDoc(
  snapshot: DocumentSnapshot<DocumentData>,
  myUid: string,
): BackendConversation | null {
  const data = snapshot.data();
  if (!data) return null;
  const participants = Array.isArray(data.participants) ? (data.participants as string[]) : [];
  const lastMessage = (data.lastMessage ?? {}) as Any;
  const lastReadAt = (data.lastReadAt ?? {}) as Record<string, unknown>;
  const myReadAt = lastReadAt[myUid] ? toIso(lastReadAt[myUid]) : '';
  const lastMsgCreated = lastMessage.createdAt ? toIso(lastMessage.createdAt) : '';
  const myUnread =
    lastMsgCreated && myReadAt
      ? lastMsgCreated > myReadAt
        ? 1
        : 0
      : 0;
  return {
    id: snapshot.id,
    jobId: typeof data.jobId === 'string' ? data.jobId : '',
    participantIds: participants,
    lastMessage:
      typeof lastMessage.content === 'string' && lastMessage.content
        ? {
            content: lastMessage.content,
            senderId: typeof lastMessage.senderId === 'string' ? lastMessage.senderId : '',
            type: 'text',
            createdAt: lastMsgCreated,
          }
        : null,
    unreadCount: { [myUid]: myUnread },
    myUnread,
    isActive: data.status !== 'closed',
    createdAt: data.createdAt ? toIso(data.createdAt) : new Date().toISOString(),
    updatedAt: data.updatedAt ? toIso(data.updatedAt) : new Date().toISOString(),
  };
}

export function messageFromDoc(
  snapshot: DocumentSnapshot<DocumentData>,
  conversationId: string,
): BackendMessage | null {
  const data = snapshot.data();
  if (!data) return null;
  return {
    id: snapshot.id,
    conversationId,
    senderId: typeof data.senderId === 'string' ? data.senderId : '',
    type: typeof data.type === 'string' ? data.type : 'text',
    content: typeof data.content === 'string' ? data.content : '',
    replyTo: typeof data.replyTo === 'string' ? data.replyTo : null,
    readAt: toIsoOrNull(data.readAt),
    deliveredAt: toIsoOrNull(data.deliveredAt),
    createdAt: data.createdAt ? toIso(data.createdAt) : new Date().toISOString(),
    updatedAt: data.updatedAt ? toIso(data.updatedAt) : new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// notifications
// ---------------------------------------------------------------------------

export function notificationFromData(data: Any): BackendNotification | null {
  if (!data) return null;
  return {
    id: typeof data.id === 'string' ? data.id : '',
    userId: typeof data.userId === 'string' ? data.userId : '',
    type: typeof data.type === 'string' ? data.type : '',
    title: typeof data.title === 'string' ? data.title : '',
    body: typeof data.body === 'string' ? data.body : '',
    data:
      data.data && typeof data.data === 'object'
        ? (data.data as Record<string, unknown>)
        : undefined,
    readAt: toIsoOrNull(data.readAt),
    createdAt: data.createdAt ? toIso(data.createdAt) : new Date().toISOString(),
  };
}

export function notificationFromDoc(
  snapshot: DocumentSnapshot<DocumentData>,
): BackendNotification | null {
  const data = snapshot.data();
  if (!data) return null;
  return notificationFromData({ ...data, id: snapshot.id });
}

// ---------------------------------------------------------------------------
// categories / skills
// ---------------------------------------------------------------------------

export function categoryFromData(data: Any): BackendCategory | null {
  if (!data) return null;
  return {
    id: typeof data.id === 'string' ? data.id : '',
    name: typeof data.name === 'string' ? data.name : '',
    slug: typeof data.slug === 'string' ? data.slug : '',
    description: typeof data.description === 'string' ? data.description : undefined,
    icon: typeof data.icon === 'string' ? data.icon : undefined,
    color: typeof data.color === 'string' ? data.color : undefined,
    imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : undefined,
    parentId: typeof data.parentId === 'string' ? data.parentId : null,
    skillIds: [],
    isActive: data.isActive === undefined ? true : data.isActive === true,
    sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 0,
    createdAt: data.createdAt ? toIso(data.createdAt) : undefined,
    updatedAt: data.updatedAt ? toIso(data.updatedAt) : undefined,
  };
}

export function categoryFromDoc(snapshot: DocumentSnapshot<DocumentData>): BackendCategory | null {
  const data = snapshot.data();
  if (!data) return null;
  return categoryFromData({ ...data, id: snapshot.id });
}

export function skillFromData(data: Any): BackendSkill | null {
  if (!data) return null;
  return {
    id: typeof data.id === 'string' ? data.id : '',
    name: typeof data.name === 'string' ? data.name : '',
    slug: typeof data.slug === 'string' ? data.slug : '',
    description: typeof data.description === 'string' ? data.description : undefined,
    icon: typeof data.icon === 'string' ? data.icon : undefined,
    categoryIds: [],
    isActive: data.isActive === undefined ? true : data.isActive === true,
    createdAt: data.createdAt ? toIso(data.createdAt) : new Date().toISOString(),
    updatedAt: data.updatedAt ? toIso(data.updatedAt) : new Date().toISOString(),
  };
}

export function skillFromDoc(snapshot: DocumentSnapshot<DocumentData>): BackendSkill | null {
  const data = snapshot.data();
  if (!data) return null;
  return skillFromData({ ...data, id: snapshot.id });
}

// ---------------------------------------------------------------------------
// Lecturas directas
// ---------------------------------------------------------------------------

export async function readUser(uid: string): Promise<BackendUser | null> {
  const snapshot = await getDoc(doc(db, 'users', uid));
  return snapshot.exists() ? userFromDoc(snapshot) : null;
}

export function fallbackBackendUser(uid: string, email: string, role = 'client'): BackendUser {
  return {
    id: uid,
    email,
    role,
    firstName: '',
    lastName: '',
    phone: '',
    rating: 0,
    ratingCount: 0,
    completedJobs: 0,
    updatedAt: new Date().toISOString(),
  };
}

/** Lee el propio perfil de Firestore; si aún no existe, construye uno mínimo
 *  a partir del token (útil para cuentas sin perfil recién registradas). */
export async function ensureBackendUser(uid: string, email: string): Promise<BackendUser> {
  const existing = await readUser(uid);
  if (existing) return existing;
  let role = 'client';
  try {
    const authUser = auth.currentUser;
    if (authUser) {
      const result = await authUser.getIdTokenResult();
      const claim = result.claims?.role;
      if (typeof claim === 'string') role = claim;
    }
  } catch {
    // Sin claim, se mantiene client.
  }
  return fallbackBackendUser(uid, email, role);
}

export async function readJob(id: string): Promise<BackendJob | null> {
  const snapshot = await getDoc(doc(db, 'jobs', id));
  return snapshot.exists() ? jobFromDoc(snapshot) : null;
}