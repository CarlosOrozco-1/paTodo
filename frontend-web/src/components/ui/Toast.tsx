import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, Info, X, AlertTriangle } from 'lucide-react';
import { useUiStore } from '@/stores/uiStore';
import { cn } from '@/utils/cn';

const variants = {
  success: {
    icon: CheckCircle2,
    classes: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    iconClasses: 'text-emerald-500',
  },
  error: {
    icon: AlertCircle,
    classes: 'border-red-200 bg-red-50 text-red-800',
    iconClasses: 'text-red-500',
  },
  warning: {
    icon: AlertTriangle,
    classes: 'border-amber-200 bg-amber-50 text-amber-800',
    iconClasses: 'text-amber-500',
  },
  info: {
    icon: Info,
    classes: 'border-blue-200 bg-blue-50 text-blue-800',
    iconClasses: 'text-blue-500',
  },
};

export function ToastContainer() {
  const toasts = useUiStore((s) => s.toasts);
  const removeToast = useUiStore((s) => s.removeToast);

  return createPortal(
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>,
    document.body,
  );
}

function ToastItem({
  toast,
  onClose,
}: {
  toast: { id: string; type: 'success' | 'error' | 'warning' | 'info'; message: string };
  onClose: () => void;
}) {
  const config = variants[toast.type];

  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const Icon = config.icon;

  return (
    <div
      className={cn(
        'pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg',
        config.classes,
      )}
    >
      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', config.iconClasses)} />
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button onClick={onClose} className="shrink-0 rounded p-0.5 opacity-50 hover:opacity-100">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}