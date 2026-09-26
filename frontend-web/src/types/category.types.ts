import type { ObjectId } from './common.types';

export interface Category {
  id: ObjectId;
  name: string;
  slug: string;
  color: string;
  description: string;
  icon: string;
  imageUrl: string;
  isActive: boolean;
  parentId: ObjectId | null;
  skillIds: ObjectId[];
  sortOrder: number;
  updatedAt: string;
}

export interface Skill {
  id: ObjectId;
  name: string;
  slug: string;
  categoryIds: ObjectId[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryDto {
  name: string;
  slug: string;
  color?: string;
  description?: string;
  icon?: string;
  imageUrl?: string;
  parentId?: ObjectId | null;
  skillIds?: ObjectId[];
}

export interface CreateSkillDto {
  name: string;
  slug: string;
  categoryIds?: ObjectId[];
}