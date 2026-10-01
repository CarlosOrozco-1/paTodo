import type { Category, Skill } from '@/types/category.types';
import type { PaginatedResponse } from '@/types/common.types';
import type { Job, JobStatus } from '@/types/job.types';
import type {
  Conversation,
  Message,
  Notification,
  ParticipantSnapshot,
} from '@/types/message.types';
import type { Offer, OfferStatus } from '@/types/offer.types';
import type { Review } from '@/types/review.types';
import type { User, UserRole } from '@/types/user.types';

const VALID_ROLES: readonly UserRole[] = ['client', 'worker', 'both', 'admin'];

/**
 * Conserva `both`: colapsarlo a `client` es pérdida de información silenciosa,
 * porque el rol llega intacto desde Firestore y desde el claim.
 */
function mapRole(value: string | undefined | null): UserRole {
  return VALID_ROLES.includes(value as UserRole) ? (value as UserRole) : 'client';
}

// ---------------------------------------------------------------------------
// Formas planas que devuelve el backend (Spring serializa los DTOs directo).
// ---------------------------------------------------------------------------

export interface BackendUser {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  bio?: string;
  phone?: string;
  skillIds?: string[];
  rating: number;
  ratingCount: number;
  completedJobs: number;
  online?: boolean;
  verified?: boolean;
  coordinates?: number[] | null;
  createdAt?: string;
  updatedAt: string;
}

export interface BackendJob {
  id: string;
  clientId: string;
  workerId?: string;
  status: string;
  acceptedOfferId?: string;
  scheduledFor?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  createdAt: string;
  updatedAt: string;
  details: {
    title: string;
    description: string;
    categoryId: string;
    skillIds?: string[];
  };
  location?: {
    type?: string;
    coordinates?: number[];
    address?: string;
    placeId?: string;
  } | null;
  pricing: {
    proposedPrice: number;
    currency?: string;
    priceType?: string;
  };
}

export interface BackendOffer {
  id: string;
  jobId: string;
  workerId: string;
  workerSnapshot?: {
    name?: string;
    rating?: number;
    completedJobs?: number;
    avatarUrl?: string;
  } | null;
  price: number;
  currency?: string;
  estimatedTime: number;
  message?: string;
  status: string;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BackendReview {
  id: string;
  jobId: string;
  reviewerId: string;
  revieweeId: string;
  rating: number;
  comment?: string;
  aspects?: {
    quality?: number | null;
    punctuality?: number | null;
    communication?: number | null;
    value?: number | null;
  } | null;
  isPublic?: boolean;
  response?: {
    comment?: string;
    createdAt?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface BackendConversation {
  id: string;
  jobId: string;
  participantIds: string[];
  participantsSnapshot?: Record<
    string,
    { name?: string; avatarUrl?: string | null }
  >;
  lastMessage?: {
    content?: string;
    senderId?: string;
    type?: string;
    createdAt?: string;
  } | null;
  unreadCount: Record<string, number>;
  myUnread: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BackendMessage {
  id: string;
  jobId?: string;
  conversationId: string;
  senderId: string;
  receiverId?: string;
  type: string;
  content: string;
  metadata?: Record<string, unknown>;
  replyTo?: string | null;
  readAt?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface BackendNotification {
  id: string;
  userId?: string;
  type: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  readAt?: string | null;
  isRead?: boolean;
  createdAt: string;
}

export interface BackendCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  color?: string;
  imageUrl?: string;
  parentId?: string | null;
  skillIds?: string[];
  isActive?: boolean;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface BackendSkill {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  categoryIds?: string[];
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface BackendPage<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

const JOB_STATUS_MAP: Record<string, JobStatus> = {
  pending: 'pending',
  published: 'published',
  open: 'pending',
  accepted: 'assigned',
  assigned: 'assigned',
  in_progress: 'in_progress',
  completed: 'completed',
  cancelled: 'cancelled',
  canceled: 'cancelled',
};

const OFFER_STATUS_MAP: Record<string, OfferStatus> = {
  pending: 'pending',
  accepted: 'accepted',
  rejected: 'rejected',
  withdrawn: 'withdrawn',
  countered: 'countered',
};

export function mapStatus<T extends string>(value: string, map: Record<string, T>, fallback: T): T {
  return map[value] ?? fallback;
}

export function mapUser(user: BackendUser): User {
  const coordinates =
    user.coordinates && Array.isArray(user.coordinates) && user.coordinates.length === 2
      ? (user.coordinates as [number, number])
      : null;
  const role: UserRole = mapRole(user.role);
  return {
    id: user.id,
    role,
    account: {
      email: user.email ?? '',
      passwordHash: '',
      verified: user.verified ?? true,
      lastLogin: null,
      loginAttempts: 0,
    },
    profile: {
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      avatarUrl: user.avatarUrl,
      bio: user.bio,
    },
    contact: {
      phone: user.phone ?? '',
      address: coordinates
        ? { country: 'GT' }
        : { country: 'GT' },
    },
    location: coordinates ? { type: 'Point', coordinates } : undefined,
    stats: {
      rating: user.rating ?? 0,
      ratingCount: user.ratingCount ?? 0,
      completedJobs: user.completedJobs ?? 0,
      cancelledJobs: 0,
      responseTimeMin: 0,
    },
    availability: {
      isOnline: Boolean(user.online),
      serviceArea: coordinates
        ? { radiusKm: 10, center: { type: 'Point', coordinates } }
        : { radiusKm: 10 },
    },
    vehicleIds: [],
    skillIds: user.skillIds ?? [],
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function mapJob(job: BackendJob): Job {
  return {
    id: job.id,
    clientId: job.clientId,
    details: {
      title: job.details.title,
      description: job.details.description,
      categoryId: job.details.categoryId,
      skillIds: job.details.skillIds ?? [],
    },
    location: {
      type: job.location?.type ?? 'Point',
      coordinates: (job.location?.coordinates ?? [0, 0]) as [number, number],
      address: job.location?.address ?? '',
    },
    pricing: {
      proposedPrice: job.pricing.proposedPrice,
      currency: job.pricing.currency ?? 'GTQ',
      priceType: (job.pricing.priceType ?? 'fixed') as Job['pricing']['priceType'],
    },
    status: mapStatus<JobStatus>(job.status, JOB_STATUS_MAP, 'pending'),
    scheduledFor: job.scheduledFor ?? null,
    cancellationReason: job.cancellationReason ?? null,
    cancelledAt: job.cancelledAt ?? null,
    completedAt: job.completedAt ?? null,
    startedAt: job.startedAt ?? null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

export function jobWithWorkerId(job: BackendJob): Job & { workerId?: string } {
  return { ...mapJob(job), workerId: job.workerId };
}

export function mapOffer(offer: BackendOffer): Offer {
  return {
    id: offer.id,
    jobId: offer.jobId,
    workerId: offer.workerId,
    workerSnapshot: {
      name: offer.workerSnapshot?.name ?? '',
      rating: offer.workerSnapshot?.rating ?? 0,
      completedJobs: offer.workerSnapshot?.completedJobs ?? 0,
      avatarUrl: offer.workerSnapshot?.avatarUrl,
    },
    price: offer.price,
    estimatedTime: offer.estimatedTime,
    message: offer.message,
    status: mapStatus<OfferStatus>(offer.status, OFFER_STATUS_MAP, 'pending'),
    currency: offer.currency ?? 'GTQ',
    expiresAt: offer.expiresAt ?? null,
    createdAt: offer.createdAt,
    updatedAt: offer.updatedAt,
  };
}

export function mapReview(review: BackendReview): Review {
  return {
    id: review.id,
    jobId: review.jobId,
    reviewerId: review.reviewerId,
    revieweeId: review.revieweeId,
    rating: review.rating,
    comment: review.comment,
    aspects: {
      quality: review.aspects?.quality ?? null,
      punctuality: review.aspects?.punctuality ?? null,
      communication: review.aspects?.communication ?? null,
      value: review.aspects?.value ?? null,
    },
    isPublic: review.isPublic ?? true,
    response: review.response?.comment ?? null,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
}

export function mapNotification(notification: BackendNotification): Notification {
  return {
    id: notification.id,
    userId: notification.userId ?? '',
    type: notification.type,
    title: notification.title ?? '',
    body: notification.body ?? '',
    read: Boolean(notification.readAt) || notification.isRead === true,
    data: notification.data,
    createdAt: notification.createdAt,
  };
}

export function mapCategory(category: BackendCategory): Category {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    color: category.color ?? '',
    description: category.description ?? '',
    icon: category.icon ?? '',
    imageUrl: category.imageUrl ?? '',
    isActive: category.isActive ?? true,
    parentId: category.parentId ?? null,
    skillIds: category.skillIds ?? [],
    sortOrder: category.sortOrder ?? 0,
    updatedAt: category.updatedAt ?? category.createdAt ?? new Date().toISOString(),
  };
}

export function mapSkill(skill: BackendSkill): Skill {
  return {
    id: skill.id,
    name: skill.name,
    slug: skill.slug,
    categoryIds: skill.categoryIds ?? [],
    isActive: skill.isActive ?? true,
    createdAt: skill.createdAt ?? new Date().toISOString(),
    updatedAt: skill.updatedAt ?? skill.createdAt ?? new Date().toISOString(),
  };
}

export function mapPage<T, R>(page: BackendPage<T>, mapper: (item: T) => R): PaginatedResponse<R> {
  return {
    items: page.content.map(mapper),
    total: page.totalElements,
    page: page.page + 1,
    limit: page.size,
    totalPages: page.totalPages,
  };
}

export function toPageArray<T>(items: T[]): PaginatedResponse<T> {
  return {
    items,
    total: items.length,
    page: 1,
    limit: items.length,
    totalPages: items.length === 0 ? 0 : 1,
  };
}

/**
 * Normaliza el snapshot de participantes: Firestore puede guardar el nombre
 * ausente y `avatarUrl` en `null`, así que se rellenan con valores seguros
 * en vez de propagar `undefined` a un campo obligatorio.
 */
function mapParticipantsSnapshot(
  raw: BackendConversation['participantsSnapshot'],
): Record<string, ParticipantSnapshot> {
  const out: Record<string, ParticipantSnapshot> = {};
  for (const [uid, value] of Object.entries(raw ?? {})) {
    out[uid] = {
      name: value?.name ?? 'Participante',
      avatarUrl: value?.avatarUrl ?? null,
    };
  }
  return out;
}

export function mapConversation(conversation: BackendConversation): Conversation {
  return {
    id: conversation.id,
    jobId: conversation.jobId ?? undefined,
    participantIds: conversation.participantIds ?? [],
    participantsSnapshot: mapParticipantsSnapshot(
      conversation.participantsSnapshot,
    ),
    lastMessage: conversation.lastMessage
      ? {
          content: conversation.lastMessage.content ?? '',
          senderId: conversation.lastMessage.senderId ?? '',
          type: (conversation.lastMessage.type ?? 'text') as Message['type'],
          createdAt: conversation.lastMessage.createdAt ?? '',
        }
      : undefined,
    unreadCount: conversation.unreadCount ?? {},
    isActive: conversation.isActive ?? true,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
}

export function mapMessage(message: BackendMessage): Message {
  return {
    id: message.id,
    jobId: message.jobId,
    conversationId: message.conversationId,
    senderId: message.senderId,
    receiverId: message.receiverId ?? undefined,
    content: message.content,
    type: (message.type ?? 'text') as Message['type'],
    replyTo: message.replyTo ?? null,
    metadata: message.metadata,
    readAt: message.readAt ?? null,
    deliveredAt: message.deliveredAt ?? null,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt ?? message.createdAt,
  };
}