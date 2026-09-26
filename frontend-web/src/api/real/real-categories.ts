import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import type { Category, Skill } from '@/types/category.types';
import type { BackendCategory, BackendSkill } from '../mappers';
import { mapCategory, mapSkill } from '../mappers';
import { NotSupportedError } from '.';
import { db } from '../firebase/init';
import { categoryFromDoc, skillFromDoc } from '../firebase/fs';

export const realCategories = {
  async getAll(): Promise<Category[]> {
    const snapshot = await getDocs(collection(db, 'categories'));
    const items = snapshot.docs
      .map((item) => categoryFromDoc(item))
      .filter((item): item is BackendCategory => item !== null)
      .map(mapCategory);
    return items.sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
    );
  },

  async getById(id: string): Promise<Category> {
    const snapshot = await getDoc(doc(db, 'categories', id));
    if (!snapshot.exists()) throw new Error('Categoría no encontrada');
    return mapCategory(categoryFromDoc(snapshot)!);
  },

  async create(): Promise<Category> {
    throw new NotSupportedError('Crear categorías no está disponible');
  },

  async update(): Promise<Category> {
    throw new NotSupportedError('Editar categorías no está disponible');
  },
};

export const realSkills = {
  async getAll(): Promise<Skill[]> {
    const snapshot = await getDocs(collection(db, 'skills'));
    const items = snapshot.docs
      .map((item) => skillFromDoc(item))
      .filter((item): item is BackendSkill => item !== null)
      .map(mapSkill);
    return items.sort((a, b) => a.name.localeCompare(b.name));
  },

  async getAllByCategory(_categoryId: string): Promise<Skill[]> {
    // En el backend nuevo las habilidades no se agrupan por categoría:
    // se devuelve el catálogo completo.
    return realSkills.getAll();
  },

  async create(): Promise<Skill> {
    throw new NotSupportedError('Crear habilidades no está disponible');
  },
};