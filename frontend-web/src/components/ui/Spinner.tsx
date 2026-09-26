import { Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
};

export function Spinner({ size = 'md', className, label }: SpinnerProps) {
  if (label) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <Loader2 className={cn('animate-spin text-brand-600', sizeClasses[size])} />
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    );
  }
  return (
    <Loader2
      className={cn('animate-spin text-brand-600', sizeClasses[size], className)}
    />
  );
}