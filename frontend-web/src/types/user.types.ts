import type { GeoPoint, ObjectId } from './common.types';

export type UserRole = 'client' | 'worker' | 'both' | 'admin';

/**
 * Roles que se pueden elegir al registrarse. `admin` queda fuera: se promueve
 * desde el panel o por consola, nunca desde el formulario público.
 */
export type RegisterRole = 'client' | 'worker' | 'both';

export interface UserAccount {
  email: string;
  passwordHash: string;
  verified: boolean;
  lastLogin?: string | null;
  loginAttempts?: number;
}

export interface UserAddress {
  street?: string;
  city?: string;
  zip?: string;
  country?: string;
}

export interface UserContact {
  phone: string;
  alternatePhone?: string;
  address?: UserAddress;
}

export interface UserProfile {
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  bio?: string;
  gender?: string;
  birthdate?: string;
}

export interface WorkingHours {
  day: string;
  start: string;
  end: string;
}

export interface ServiceArea {
  radiusKm: number;
  center?: GeoPoint;
}

export interface UserAvailability {
  isOnline: boolean;
  workingHours?: WorkingHours[];
  serviceArea: ServiceArea;
}

export interface UserStats {
  rating: number;
  ratingCount: number;
  completedJobs: number;
  cancelledJobs: number;
  responseTimeMin: number;
}

export interface User {
  id: ObjectId;
  role: UserRole;
  account: UserAccount;
  profile: UserProfile;
  contact: UserContact;
  location?: GeoPoint;
  stats: UserStats;
  availability: UserAvailability;
  vehicleIds: ObjectId[];
  skillIds: ObjectId[];
  createdAt?: string;
  updatedAt: string;
}

export interface CreateUserDto {
  role: UserRole;
  account: Pick<UserAccount, 'email'> & { password: string };
  profile: UserProfile;
  contact: UserContact;
}

export interface UpdateUserDto {
  profile?: Partial<UserProfile>;
  contact?: Partial<UserContact>;
  availability?: Partial<UserAvailability>;
  location?: GeoPoint;
  skillIds?: ObjectId[];
}