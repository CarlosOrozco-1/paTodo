import type { CreateJobDto, Job, UpdateJobDto } from '@/types/job.types';
import type { PaginatedResponse, QueryParams } from '@/types/common.types';
import { isDemoMode } from './demo';
import { demoJobs } from './demo/demo-jobs';
import { realJobs } from './real';

export const jobsService = {
  async getAll(params?: QueryParams): Promise<PaginatedResponse<Job>> {
    if (isDemoMode()) return demoJobs.getAll(params);
    return realJobs.getAll(params);
  },

  async getById(id: string): Promise<Job> {
    if (isDemoMode()) return demoJobs.getById(id);
    return realJobs.getById(id);
  },

  async getByClient(clientId: string, params?: QueryParams): Promise<PaginatedResponse<Job>> {
    if (isDemoMode()) return demoJobs.getByClient(clientId, params);
    return realJobs.getByClient(clientId, params);
  },

  async getAvailable(params?: QueryParams): Promise<PaginatedResponse<Job>> {
    if (isDemoMode()) return demoJobs.getAvailable(params);
    return realJobs.getAvailable(params);
  },

  async getByWorker(workerId: string, params?: QueryParams): Promise<PaginatedResponse<Job>> {
    if (isDemoMode()) return demoJobs.getByWorker(workerId, params);
    return realJobs.getByWorker(workerId, params);
  },

  async create(data: CreateJobDto): Promise<Job> {
    if (isDemoMode()) return demoJobs.create(data);
    return realJobs.create(data);
  },

  async update(id: string, data: UpdateJobDto): Promise<Job> {
    if (isDemoMode()) return demoJobs.update(id, data);
    return realJobs.update(id, data);
  },

  async updateStatus(id: string, status: Job['status']): Promise<Job> {
    if (isDemoMode()) return demoJobs.updateStatus(id, status);
    return realJobs.updateStatus(id, status);
  },

  async cancel(id: string, reason: string): Promise<Job> {
    if (isDemoMode()) return demoJobs.cancel(id, reason);
    return realJobs.cancel(id, reason);
  },

  async assign(id: string, offerId: string): Promise<Job> {
    if (isDemoMode()) return demoJobs.assign(id, offerId);
    return realJobs.assign(id, offerId);
  },

  async complete(id: string): Promise<Job> {
    if (isDemoMode()) return demoJobs.complete(id);
    return realJobs.complete(id);
  },
};