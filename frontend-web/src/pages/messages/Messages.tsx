import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { conversationsService, messagesService } from '@/api/messages.service';
import { usersService } from '@/api/users.service';
import type { Conversation } from '@/types/message.types';
import type { Message } from '@/types/message.types';
import type { User } from '@/types/user.types';
import { ConversationList } from '@/components/messages/ConversationList';
import { ChatWindow } from '@/components/messages/ChatWindow';
import { toast } from '@/stores/uiStore';
import { getErrorMessage } from '@/api/axiosClient';

export function Messages() {
  const { user } = useAuthStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [userMap, setUserMap] = useState<Record<string, User>>({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      try {
        const convs = await conversationsService.getAll();
        setConversations(convs);
        setActiveConversation((current) => current ?? convs[0] ?? null);

        const ids = new Set<string>();
        convs.forEach((c) => c.participantIds.forEach((p) => ids.add(p)));
        ids.add(user.id);

        const users = await Promise.all(
          [...ids].map((id) => usersService.getById(id)),
        );
        const map = Object.fromEntries(users.map((u) => [u.id, u]));
        setUserMap(map);
      } catch {
        setConversations([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  useEffect(() => {
    if (!activeConversation || !user) {
      setMessages([]);
      return;
    }

    let cancelled = false;

    const loadMessages = async (markRead = false) => {
      try {
        const msgs = await messagesService.getByConversation(activeConversation.id);
        if (cancelled) return;
        setMessages(msgs);
        if (markRead) await messagesService.markAsRead(activeConversation.id);
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConversation.id
              ? { ...c, unreadCount: { ...c.unreadCount, [user.id]: 0 } }
              : c,
          ),
        );
      } catch (error) {
        if (!cancelled) toast('error', getErrorMessage(error));
      }
    };

    void loadMessages(true);
    const refreshTimer = window.setInterval(() => void loadMessages(), 5000);

    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
    };
  }, [activeConversation, user]);

  const handleSelect = (conversation: Conversation) => {
    setActiveConversation(conversation);
    setMessages([]);
  };

  const handleSend = async (content: string) => {
    if (!user || !activeConversation) return;
    setSending(true);
    try {
      const otherId = activeConversation.participantIds.find((id) => id !== user.id);
      if (!otherId) return;
      const msg = await messagesService.send({
        jobId: activeConversation.jobId,
        receiverId: otherId,
        content,
      });
      setMessages((prev) => [...prev, msg]);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversation.id
            ? {
                ...c,
                lastMessage: {
                  content,
                  senderId: user.id,
                  type: 'text',
                  createdAt: new Date().toISOString(),
                },
              }
            : c,
        ),
      );
    } catch (error) {
      toast('error', getErrorMessage(error));
    } finally {
      setSending(false);
    }
  };

  const otherUser = activeConversation
    ? userMap[
        activeConversation.participantIds.find((id) => id !== user?.id) || ''
      ]
    : undefined;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-gray-50">
      <div className="border-b border-gray-200 bg-white px-4 py-3">
        <h1 className="text-lg font-bold text-gray-900">Mensajes</h1>
      </div>
      <div className="mx-auto flex w-full max-w-7xl flex-1 overflow-hidden">
        <div
          className={`w-full border-r border-gray-200 bg-white sm:w-80 ${
            activeConversation ? 'hidden sm:block' : 'block'
          }`}
        >
          {loading ? (
            <p className="p-6 text-center text-sm text-gray-400">Cargando...</p>
          ) : (
            <ConversationList
              conversations={conversations}
              activeConversationId={activeConversation?.id}
              userId={user?.id || ''}
              userNames={Object.fromEntries(
                Object.entries(userMap).map(([id, u]) => [
                  id,
                  `${u.profile.firstName} ${u.profile.lastName}`.trim(),
                ]),
              )}
              userAvatars={Object.fromEntries(
                Object.entries(userMap).map(([id, u]) => [
                  id,
                  u.profile.avatarUrl || '',
                ]),
              )}
              onSelect={handleSelect}
            />
          )}
        </div>
        <div
          className={`flex-1 ${
            activeConversation ? 'block' : 'hidden sm:block'
          }`}
        >
          <ChatWindow
            messages={messages}
            currentUserId={user?.id || ''}
            otherUserName={
              otherUser
                ? `${otherUser.profile.firstName} ${otherUser.profile.lastName}`
                : undefined
            }
            otherUserAvatar={otherUser?.profile.avatarUrl}
            onSend={handleSend}
            sending={sending}
            empty={!activeConversation}
          />
        </div>
      </div>
    </div>
  );
}