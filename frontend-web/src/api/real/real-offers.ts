import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import type { CreateOfferDto, Offer, UpdateOfferDto } from '@/types/offer.types';
import type { PaginatedResponse, QueryParams } from '@/types/common.types';
import type { BackendOffer } from '../mappers';
import { mapOffer, toPageArray } from '../mappers';
import { NotSupportedError } from '.';
import { db } from '../firebase/init';
import { offerFromDoc, requireUid } from '../firebase/fs';
import { apiPost } from '../firebase/rest';

export const realOffers = {
  async getAllByJob(jobId: string): Promise<Offer[]> {
    const snapshot = await getDocs(query(collection(db, 'offers'), where('jobId', '==', jobId)));
    const items = snapshot.docs
      .map((item) => offerFromDoc(item))
      .filter((item): item is BackendOffer => item !== null)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return items.map(mapOffer);
  },

  async getAllByWorker(workerId: string, _params?: QueryParams): Promise<PaginatedResponse<Offer>> {
    const snapshot = await getDocs(query(collection(db, 'offers'), where('workerId', '==', workerId)));
    const items = snapshot.docs
      .map((item) => offerFromDoc(item))
      .filter((item): item is BackendOffer => item !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return toPageArray(items.map(mapOffer));
  },

  async getById(id: string): Promise<Offer> {
    const snapshot = await getDoc(doc(db, 'offers', id));
    if (!snapshot.exists()) throw new Error('Oferta no encontrada');
    return mapOffer(offerFromDoc(snapshot)!);
  },

  async create(data: CreateOfferDto): Promise<Offer> {
    const uid = requireUid();
    const snapshot = await getDoc(doc(db, 'users', uid));
    const profile = (snapshot.exists() ? snapshot.data()?.profile ?? {} : {}) as Record<string, unknown>;
    const stats = (snapshot.exists() ? snapshot.data()?.stats ?? {} : {}) as Record<string, unknown>;
    const ref = await addDoc(collection(db, 'offers'), {
      jobId: data.jobId,
      workerId: uid,
      workerSnapshot: {
        name:
          `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim() ||
          'Trabajador',
        avatarUrl: typeof profile.avatarUrl === 'string' ? profile.avatarUrl : null,
        rating: typeof stats.rating === 'number' ? stats.rating : 0,
        completedJobs: typeof stats.completedJobs === 'number' ? stats.completedJobs : 0,
      },
      price: data.price,
      currency: 'GTQ',
      estimatedTime: data.estimatedTime,
      message: data.message ?? '',
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const created = await getDoc(ref);
    return mapOffer(offerFromDoc(created)!);
  },

  async update(_id: string, _data: UpdateOfferDto): Promise<Offer> {
    throw new NotSupportedError('Editar una oferta no está disponible');
  },

  async accept(id: string): Promise<Offer> {
    const offerRef = doc(db, 'offers', id);
    const current = await getDoc(offerRef);
    if (!current.exists()) throw new Error('Oferta no encontrada');
    const offer = offerFromDoc(current)!;
    await apiPost('/acceptOffer', { jobId: offer.jobId, offerId: id });
    const updated = await getDoc(offerRef);
    return mapOffer(offerFromDoc(updated)!);
  },

  async reject(_id: string): Promise<Offer> {
    // En el backend nuevo no existe rechazo individual: al aceptar una oferta
    // las demás se rechazan solas, y cancelar el trabajo rechaza las pendientes.
    throw new NotSupportedError(
      'Rechazar una oferta individual no está disponible en este backend',
    );
  },

  async withdraw(id: string): Promise<Offer> {
    const ref = doc(db, 'offers', id);
    await updateDoc(ref, {
      status: 'withdrawn',
      updatedAt: serverTimestamp(),
    });
    const updated = await getDoc(ref);
    return mapOffer(offerFromDoc(updated)!);
  },
};