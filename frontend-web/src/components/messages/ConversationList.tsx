import { Mail } from 'lucide-react';
import type { Conversation } from '@/types/message.types';
import { Avatar } from '@/components/ui/Avatar';
import { SearchBar } from '@/components/ui/SearchBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { timeAgo } from '@/utils/formatters';
import { cn } from '@/utils/cn';
import { useState } from 'react';

interface ConversationListProps {
  conversations: Conversation[];
  activeConversationId?: string | null;
  userId: string;
  userNames: Record<string, string>;
  userAvatars: Record<string, string>;
  onSelect: (conversation: Conversation) => void;
}

export function ConversationList({
  conversations,
  activeConversationId,
  userId,
  userNames,
  userAvatars,
  onSelect,
}: ConversationListProps) {
  const [search, setSearch] = useState('');
  const filtered = conversations.filter((conv) => {
    const otherId = conv.participantIds.find((id) => id !== userId);
    if (!otherId) return true;
    const name = userNames[otherId] || 'Usuario';
    return name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-200 p-3">
        <SearchBar onSearch={setSearch} placeholder="Buscar conversación..." />
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="Sin conversaciones"
              description="Cuando tengas mensajes con profesionales o clientes, aparecerán aquí."
              icon={<Mail className="h-8 w-8" />}
            />
          </div>
        ) : (
          filtered.map((conv) => {
            const otherId = conv.participantIds.find((id) => id !== userId) || '';
            const name = userNames[otherId] || 'Usuario';
            const unread = conv.unreadCount?.[userId] || 0;
            return (
              <button
                key={conv.id}
                onClick={() => onSelect(conv)}
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
                  'hover:bg-gray-50',
                  activeConversationId === conv.id && 'bg-brand-50',
                )}
              >
                <Avatar name={name} src={userAvatars[otherId]} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {name}
                    </p>
                    {conv.lastMessage && (
                      <span className="ml-2 shrink-0 text-[11px] text-gray-400">
                        {timeAgo(conv.lastMessage.createdAt)}
                      </span>
                    )}
                  </div>
                  <p className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-gray-500">
                      {conv.lastMessage?.content || 'Inicia la conversación'}
                    </span>
                    {unread > 0 && (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[11px] font-bold text-white">
                        {unread}
                      </span>
                    )}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}