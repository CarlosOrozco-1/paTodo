import type { CreateOfferDto, Offer, UpdateOfferDto } from '@/types/offer.types';
import type { PaginatedResponse, QueryParams } from '@/types/common.types';
import { isDemoMode } from './demo';
import { demoOffers } from './demo/demo-offers';
import { realOffers } from './real';

export const offersService = {
  async getAllByJob(jobId: string): Promise<Offer[]> {
    if (isDemoMode()) return demoOffers.getAllByJob(jobId);
    return realOffers.getAllByJob(jobId);
  },

  async getAllByWorker(workerId: string, params?: QueryParams): Promise<PaginatedResponse<Offer>> {
    if (isDemoMode()) return demoOffers.getAllByWorker(workerId, params);
    return realOffers.getAllByWorker(workerId, params);
  },

  async getById(id: string): Promise<Offer> {
    if (isDemoMode()) return demoOffers.getById(id);
    return realOffers.getById(id);
  },

  async create(data: CreateOfferDto): Promise<Offer> {
    if (isDemoMode()) return demoOffers.create(data);
    return realOffers.create(data);
  },

  async update(id: string, data: UpdateOfferDto): Promise<Offer> {
    if (isDemoMode()) return demoOffers.update(id, data);
    return realOffers.update(id, data);
  },

  async accept(id: string): Promise<Offer> {
    if (isDemoMode()) return demoOffers.accept(id);
    return realOffers.accept(id);
  },

  async reject(id: string): Promise<Offer> {
    if (isDemoMode()) return demoOffers.reject(id);
    return realOffers.reject(id);
  },

  async withdraw(id: string): Promise<Offer> {
    if (isDemoMode()) return demoOffers.withdraw(id);
    return realOffers.withdraw(id);
  },
};