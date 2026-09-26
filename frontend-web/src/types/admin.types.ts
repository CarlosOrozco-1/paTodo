export interface DashboardStats {
  totalUsers: number;
  totalClients: number;
  totalWorkers: number;
  totalJobs: number;
  activeJobs: number;
  pendingJobs: number;
  completedJobs: number;
  cancelledJobs: number;
  totalOffers: number;
  pendingOffers: number;
  acceptedOffers: number;
  averageRating: number;
  totalRevenue: number;
  currency: string;
  activeUsersToday: number;
  newUsersThisWeek: number;
  newJobsThisWeek: number;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  description: string;
  createdAt: string;
}

export interface UserAdminView {
  id: string;
  profile: {
    firstName: string;
    lastName: string;
    avatarUrl?: string;
  };
  account: {
    email: string;
    verified: boolean;
    lastLogin?: string | null;
  };
  role: string;
  stats: {
    rating: number;
    ratingCount: number;
    completedJobs: number;
  };
  status: 'active' | 'suspended' | 'pending_verification';
  createdAt: string;
}

export interface CategoriesDistribution {
  label: string;
  value: number;
  color: string;
}

export interface JobsByStatus {
  status: string;
  count: number;
}