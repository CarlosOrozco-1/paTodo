import { useState } from 'react';
import type { CreateReviewDto } from '@/types/review.types';
import { StarRating } from '@/components/ui/StarRating';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';

interface ReviewFormProps {
  onSubmit: (data: CreateReviewDto) => Promise<void>;
  submitting?: boolean;
}

export function ReviewForm({ onSubmit, submitting = false }: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [aspects, setAspects] = useState({
    quality: 0,
    punctuality: 0,
    communication: 0,
    value: 0,
  });
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('Selecciona una calificación');
      return;
    }
    setError('');
    await onSubmit({
      rating,
      comment: comment.trim() || undefined,
      aspects,
      isPublic: true,
    });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-lg bg-gray-50 p-4 text-center">
        <p className="mb-2 text-sm font-medium text-gray-700">Calificación general</p>
        <div className="flex justify-center">
          <StarRating
            rating={rating}
            size="lg"
            interactive
            onChange={setRating}
            showValue
          />
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-gray-700">Calificación por aspecto</p>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ['quality', 'Calidad'],
              ['punctuality', 'Puntualidad'],
              ['communication', 'Comunicación'],
              ['value', 'Precio'],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="rounded-lg border border-gray-200 p-3">
              <p className="mb-1.5 text-xs font-medium text-gray-500">{label}</p>
              <StarRating
                rating={aspects[key]}
                interactive
                onChange={(value) =>
                  setAspects((prev) => ({ ...prev, [key]: value }))
                }
              />
            </div>
          ))}
        </div>
      </div>

      <Textarea
        label="Comentario"
        placeholder="Cuenta tu experiencia con este profesional..."
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      <Button fullWidth onClick={handleSubmit} loading={submitting}>
        Enviar reseña
      </Button>
    </div>
  );
}