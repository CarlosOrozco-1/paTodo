import { useState } from 'react';
import { useNavigate } from 'react-router';
import { MapPin, Tag, CheckCircle2 } from 'lucide-react';
import type { CreateJobDto } from '@/types/job.types';
import type { Category, Skill } from '@/types/category.types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { toast } from '@/stores/uiStore';
import { cn } from '@/utils/cn';

interface JobFormProps {
  categories: Category[];
  skills: Skill[];
  onSubmit: (data: CreateJobDto) => Promise<void>;
  submitting?: boolean;
}

export function JobForm({ categories, skills, onSubmit, submitting = false }: JobFormProps) {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [address, setAddress] = useState('');
  const [price, setPrice] = useState('');
  const [priceType, setPriceType] = useState<'fixed' | 'negotiable'>('fixed');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const skillsForCategory = categoryId
    ? skills.filter((s) => s.categoryIds.includes(categoryId))
    : skills;

  const toggleSkill = (skillId: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skillId)
        ? prev.filter((id) => id !== skillId)
        : [...prev, skillId],
    );
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = 'El título es obligatorio';
    if (!description.trim()) next.description = 'La descripción es obligatoria';
    if (!categoryId) next.categoryId = 'Selecciona una categoría';
    if (selectedSkills.length === 0) next.skills = 'Selecciona al menos una habilidad';
    if (!address.trim()) next.address = 'La dirección es obligatoria';
    if (!price || Number(price) <= 0)
      next.price = 'Ingresa un precio válido mayor a 0';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    try {
      await onSubmit({
        details: {
          title: title.trim(),
          description: description.trim(),
          categoryId,
          skillIds: selectedSkills,
        },
        location: {
          coordinates: [-90.5069, 14.6349],
          address: address.trim(),
        },
        pricing: {
          proposedPrice: Number(price),
          currency: 'GTQ',
          priceType,
        },
      });
      toast('success', 'Trabajo publicado correctamente');
      navigate('/cliente/mis-trabajos');
    } catch {
      toast('error', 'No se pudo publicar el trabajo');
    }
  };

  return (
    <div className="space-y-6">
      {/* Título y Categoría */}
      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          label="Título del trabajo *"
          placeholder="Ej: Cambio de llanta urgente"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={errors.title}
        />
        <Select
          label="Categoría *"
          placeholder="Selecciona una categoría"
          options={categories
            .filter((c) => c.isActive)
            .map((c) => ({ value: c.id, label: c.name }))}
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setSelectedSkills([]);
          }}
          error={errors.categoryId}
        />
      </div>

      {/* Descripción */}
      <Textarea
        label="Descripción del trabajo *"
        placeholder="Describe qué necesitas, con detalles como dimensiones, materiales, urgencia, etc."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        error={errors.description}
      />

      {/* Habilidades Requeridas */}
      {categoryId && (
        <div className="rounded-2xl bg-gray-50/80 p-4 border border-gray-100">
          <p className="mb-2.5 text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5 text-brand-600" />
            Habilidades requeridas *
          </p>
          {skillsForCategory.length === 0 ? (
            <p className="text-xs text-gray-500 italic">
              No hay habilidades específicas registradas para esta categoría.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {skillsForCategory.map((skill) => {
                const isSelected = selectedSkills.includes(skill.id);
                return (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() => toggleSkill(skill.id)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer shadow-xs',
                      isSelected
                        ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20 ring-2 ring-brand-600/30'
                        : 'border border-gray-200 bg-white text-gray-700 hover:border-brand-300 hover:bg-brand-50/50'
                    )}
                  >
                    {isSelected && <CheckCircle2 className="h-3.5 w-3.5" />}
                    {skill.name}
                  </button>
                );
              })}
            </div>
          )}
          {errors.skills && (
            <p className="mt-2 text-xs font-medium text-red-600">{errors.skills}</p>
          )}
        </div>
      )}

      {/* Precio y Tipo de Precio Alineados */}
      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          label="Precio propuesto (GTQ) *"
          type="number"
          min="0"
          placeholder="Ej: 250"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          leftIcon={<span className="text-lg text-brand-600">Q</span>} 
          error={errors.price}
        />

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
            Tipo de precio
          </label>
          <div className="flex rounded-2xl bg-gray-100/80 p-1 border border-gray-200/60">
            <button
              type="button"
              onClick={() => setPriceType('fixed')}
              className={cn(
                'flex-1 rounded-xl py-2 text-xs font-bold transition-all cursor-pointer',
                priceType === 'fixed'
                  ? 'bg-white text-gray-900 shadow-xs ring-1 ring-gray-200'
                  : 'text-gray-500 hover:text-gray-800'
              )}
            >
              Precio fijo
            </button>
            <button
              type="button"
              onClick={() => setPriceType('negotiable')}
              className={cn(
                'flex-1 rounded-xl py-2 text-xs font-bold transition-all cursor-pointer',
                priceType === 'negotiable'
                  ? 'bg-white text-gray-900 shadow-xs ring-1 ring-gray-200'
                  : 'text-gray-500 hover:text-gray-800'
              )}
            >
              Negociable
            </button>
          </div>
        </div>
      </div>

      {/* Dirección */}
      <Input
        label="Dirección de ubicación *"
        placeholder="Ej: Zona 10, Ciudad de Guatemala (15 Avenida 10-23)"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        leftIcon={<MapPin className="h-4 w-4 text-brand-600" />}
        error={errors.address}
      />

      {/* Botones de Acción */}
      <div className="mt-8 flex flex-col-reverse justify-end gap-3 border-t border-gray-100 pt-6 sm:flex-row sm:items-center">
        <Button
          variant="outline"
          onClick={() => navigate(-1)}
          className="w-full sm:w-auto transition-all hover:bg-red-50 hover:text-red-600 hover:border-red-200 rounded-xl"
        >
          Cancelar
        </Button>
        <Button 
          onClick={handleSubmit} 
          loading={submitting}
          className="w-full sm:w-auto shadow-md shadow-brand-600/20 transition-all hover:-translate-y-0.5 rounded-xl"
        >
          Publicar trabajo
        </Button>
      </div>
    </div>
  );
}