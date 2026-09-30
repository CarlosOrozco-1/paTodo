import type { Category, CreateCategoryDto, CreateSkillDto, Skill } from '@/types/category.types';
import { isDemoMode } from './demo';
import { demoCategories, demoSKills } from './demo/demo-categories';
import { realCategories, realSkills } from './real';

export const categoriesService = {
  async getAll(): Promise<Category[]> {
    if (isDemoMode()) return demoCategories.getAll();
    return realCategories.getAll();
  },

  async getById(id: string): Promise<Category> {
    if (isDemoMode()) return demoCategories.getById(id);
    return realCategories.getById(id);
  },

  async create(data: CreateCategoryDto): Promise<Category> {
    if (isDemoMode()) return demoCategories.create(data);
    return realCategories.create(data);
  },

  async update(id: string, data: Partial<CreateCategoryDto>): Promise<Category> {
    if (isDemoMode()) return demoCategories.update(id, data);
    return realCategories.update(id, data);
  },
};

export const skillsService = {
  async getAll(): Promise<Skill[]> {
    if (isDemoMode()) return demoSKills.getAll();
    return realSkills.getAll();
  },

  async getAllByCategory(categoryId: string): Promise<Skill[]> {
    if (isDemoMode()) return demoSKills.getAll();
    return realSkills.getAllByCategory(categoryId);
  },

  async create(data: CreateSkillDto): Promise<Skill> {
    if (isDemoMode()) return demoSKills.create(data);
    return realSkills.create(data);
  },
};