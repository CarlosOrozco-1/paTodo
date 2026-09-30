import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import type { Category, CreateCategoryDto, CreateSkillDto, Skill } from '@/types/category.types';
import type { BackendCategory, BackendSkill } from '../mappers';
import { mapCategory, mapSkill } from '../mappers';
import { db } from '../firebase/init';
import { categoryFromData, skillFromData } from '../firebase/fs';

export const realCategories = {
  async getAll(): Promise<Category[]> {
    const snapshot = await getDocs(collection(db, 'categories'));
    const items = snapshot.docs
      .map((item) => categoryFromData({ ...item.data(), id: item.id }))
      .filter((item): item is BackendCategory => item !== null)
      .map(mapCategory);
    return items.sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
    );
  },

  async getById(id: string): Promise<Category> {
    const snapshot = await getDoc(doc(db, 'categories', id));
    if (!snapshot.exists()) throw new Error('Categoría no encontrada');
    const backend = categoryFromData({ ...snapshot.data(), id: snapshot.id });
    if (!backend) throw new Error('Categoría no encontrada');
    return mapCategory(backend);
  },

  async create(data: CreateCategoryDto): Promise<Category> {
    const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const ref = doc(db, 'categories', slug);
    await setDoc(ref, {
      name: data.name,
      slug,
      description: data.description ?? '',
      icon: data.icon ?? null,
      color: data.color ?? null,
      imageUrl: data.imageUrl ?? null,
      parentId: data.parentId ?? null,
      isActive: true,
      sortOrder: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const created = await getDoc(ref);
    if (!created.exists()) throw new Error('No se pudo crear la categoría');
    const backend = categoryFromData({ ...created.data(), id: created.id });
    if (!backend) throw new Error('No se pudo crear la categoría');
    return mapCategory(backend);
  },

  async update(id: string, data: Partial<CreateCategoryDto>): Promise<Category> {
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.slug !== undefined) patch.slug = data.slug;
    if (data.description !== undefined) patch.description = data.description;
    if (data.icon !== undefined) patch.icon = data.icon;
    if (data.color !== undefined) patch.color = data.color;
    if (data.imageUrl !== undefined) patch.imageUrl = data.imageUrl;
    if (data.parentId !== undefined) patch.parentId = data.parentId;
    patch.updatedAt = serverTimestamp();
    await updateDoc(doc(db, 'categories', id), patch);
    const updated = await getDoc(doc(db, 'categories', id));
    if (!updated.exists()) throw new Error('Categoría no encontrada');
    const backend = categoryFromData({ ...updated.data(), id: updated.id });
    if (!backend) throw new Error('Categoría no encontrada');
    return mapCategory(backend);
  },
};

export const realSkills = {
  async getAll(): Promise<Skill[]> {
    const snapshot = await getDocs(collection(db, 'skills'));
    const items = snapshot.docs
      .map((item) => skillFromData({ ...item.data(), id: item.id }))
      .filter((item): item is BackendSkill => item !== null)
      .map(mapSkill);
    return items.sort((a, b) => a.name.localeCompare(b.name));
  },

  async getAllByCategory(_categoryId: string): Promise<Skill[]> {
    // En el catalogo las habilidades no se agrupan por categoría:
    // se devuelve el catálogo completo.
    return realSkills.getAll();
  },

  async create(data: CreateSkillDto): Promise<Skill> {
    const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const ref = doc(db, 'skills', slug);
    await setDoc(ref, {
      name: data.name,
      slug,
      categoryIds: data.categoryIds ?? [],
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const created = await getDoc(ref);
    if (!created.exists()) throw new Error('No se pudo crear la habilidad');
    const backend = skillFromData({ ...created.data(), id: created.id });
    if (!backend) throw new Error('No se pudo crear la habilidad');
    return mapSkill(backend);
  },
};