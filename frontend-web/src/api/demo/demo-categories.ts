import type { Category, CreateCategoryDto, CreateSkillDto, Skill } from '@/types/category.types';
import { sleep } from './index';
import { db, nowIso, saveDb, uid } from './demoDb';

export const demoCategories = {
  async getAll(): Promise<Category[]> {
    await sleep(60);
    return db().categories.filter((c) => c.isActive);
  },

  async getById(id: string): Promise<Category> {
    await sleep(60);
    const cat = db().categories.find((c) => c.id === id);
    if (!cat) throw new Error('Categoría no encontrada');
    return cat;
  },

  async create(data: CreateCategoryDto): Promise<Category> {
    await sleep(150);
    const d = db();
    const category: Category = {
      id: uid('demo-cat'),
      color: data.color || '#64748b',
      description: data.description || '',
      icon: data.icon || '',
      imageUrl: data.imageUrl || '',
      isActive: true,
      parentId: data.parentId ?? null,
      skillIds: data.skillIds || [],
      sortOrder: d.categories.length + 1,
      updatedAt: nowIso(),
      ...data,
    };
    d.categories.push(category);
    saveDb(d);
    return category;
  },

  async update(id: string, data: Partial<CreateCategoryDto>): Promise<Category> {
    await sleep(150);
    const d = db();
    const idx = d.categories.findIndex((c) => c.id === id);
    if (idx < 0) throw new Error('Categoría no encontrada');
    d.categories[idx] = { ...d.categories[idx], ...data, updatedAt: nowIso() };
    saveDb(d);
    return d.categories[idx];
  },
};

export const demoSKills = {
  async getAll(): Promise<Skill[]> {
    await sleep(60);
    return db().skills.filter((s) => s.isActive);
  },

  async create(data: CreateSkillDto): Promise<Skill> {
    await sleep(150);
    const d = db();
    const skill: Skill = {
      id: uid('demo-skill'),
      name: data.name,
      slug: data.slug,
      categoryIds: data.categoryIds || [],
      isActive: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    d.skills.push(skill);
    saveDb(d);
    return skill;
  },
};