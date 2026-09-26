import type { Message } from '@/types/message.types';
import { cn } from '@/utils/cn';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  senderName?: string;
  showTime?: boolean;
}

export function MessageBubble({ message, isOwn, senderName, showTime = true }: MessageBubbleProps) {
  const time = new Date(message.createdAt);
  const timeLabel = Number.isNaN(time.getTime())
    ? ''
    : new Intl.DateTimeFormat('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(time);

  return (
    <div className={cn('flex flex-col gap-1', isOwn ? 'items-end' : 'items-start')}>
      {!isOwn && senderName && (
        <span className="px-1 text-[11px] font-medium text-gray-400">{senderName}</span>
      )}
      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-4 py-2 text-sm',
          isOwn
            ? 'rounded-br-md bg-brand-600 text-white'
            : 'rounded-bl-md bg-gray-100 text-gray-800',
        )}
      >
        {message.content}
        {showTime && (
          <span
            className={cn(
              'ml-2 whitespace-nowrap text-[10px]',
              isOwn ? 'text-brand-100' : 'text-gray-400',
            )}
          >
            {timeLabel}
          </span>
        )}
      </div>
    </div>
  );
}