import { useEffect, useRef, useState } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import type { Message } from '@/types/message.types';
import { MessageBubble } from './MessageBubble';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/utils/cn';

interface ChatWindowProps {
  messages: Message[];
  currentUserId: string;
  otherUserName?: string;
  otherUserAvatar?: string;
  onSend: (content: string) => Promise<void>;
  sending?: boolean;
  empty?: boolean;
}

export function ChatWindow({
  messages,
  currentUserId,
  otherUserName,
  otherUserAvatar,
  onSend,
  sending = false,
  empty = false,
}: ChatWindowProps) {
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async () => {
    const content = draft.trim();
    if (!content || sending) return;
    setDraft('');
    await onSend(content);
  };

  if (empty) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-white">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-400">
          <MessageSquare className="h-8 w-8" />
        </div>
        <p className="text-sm font-medium text-gray-700">Selecciona una conversación</p>
        <p className="text-xs text-gray-400">
          Elige una conversación de la lista para ver los mensajes
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white">
      {otherUserName && (
        <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3">
          <Avatar name={otherUserName} src={otherUserAvatar} size="sm" />
          <p className="text-sm font-semibold text-gray-900">{otherUserName}</p>
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto bg-gray-50 p-4">
        {messages.length === 0 ? (
          <EmptyState
            title="Sin mensajes aún"
            description="Envía el primer mensaje para iniciar la conversación."
            icon={<MessageSquare className="h-8 w-8" />}
          />
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isOwn={msg.senderId === currentUserId}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-gray-200 p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Escribe un mensaje..."
            rows={2}
            className="flex-1 resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim() || sending}
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white',
              'transition-colors hover:bg-brand-700',
              'disabled:cursor-not-allowed disabled:opacity-40',
            )}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}