import { useState } from 'react';
import type { CreateOfferDto } from '@/types/offer.types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';

interface OfferFormProps {
  onSubmit: (data: Omit<CreateOfferDto, 'jobId'>) => Promise<void>;
  submitting?: boolean;
  jobProposedPrice?: number;
  jobCurrency?: string;
}

export function OfferForm({
  onSubmit,
  submitting = false,
  jobProposedPrice,
  jobCurrency = 'GTQ',
}: OfferFormProps) {
  const [price, setPrice] = useState(jobProposedPrice ? String(jobProposedPrice) : '');
  const [estimatedTime, setEstimatedTime] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!price || Number(price) <= 0) next.price = 'Ingresa un precio válido';
    const time = Number(estimatedTime);
    if (!estimatedTime || Number.isNaN(time) || time < 5)
      next.estimatedTime = 'Mínimo 5 minutos';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    await onSubmit({
      price: Number(price),
      estimatedTime: Number(estimatedTime),
      message: message.trim() || undefined,
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label={`Tu precio (${jobCurrency}) *`}
          type="number"
          min="0"
          placeholder="Ej: 300"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          error={errors.price}
        />
        <Input
          label="Tiempo estimado (min) *"
          type="number"
          min="5"
          placeholder="Ej: 45"
          value={estimatedTime}
          onChange={(e) => setEstimatedTime(e.target.value)}
          error={errors.estimatedTime}
        />
      </div>
      <Textarea
        label="Mensaje para el cliente"
        placeholder="Explica qué incluye tu oferta, materiales, garantía, etc."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <Button fullWidth onClick={handleSubmit} loading={submitting}>
        Enviar oferta
      </Button>
    </div>
  );
}