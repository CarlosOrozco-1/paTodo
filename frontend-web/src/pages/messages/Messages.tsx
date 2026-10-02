import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const jobIdParam = searchParams.get('jobId');
  const conversationIdParam = searchParams.get('conversationId');
  const userIdParam = searchParams.get('userId');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  // Se guarda el ID activo, no el objeto: la suscripción de conversaciones
  // emite un objeto nuevo en cada cambio y usar su identidad como dependencia
  // re-suscribía los mensajes sin parar (y disparaba markAsRead en bucle).
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [userMap, setUserMap] = useState<Record<string, User>>({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const markedReadRef = useRef<string | null>(null);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) ?? null,
    [conversations, activeConversationId],
  );

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const loadProfiles = async (convs: Conversation[]) => {
      const ids = new Set<string>();
      convs.forEach((c) => c.participantIds.forEach((p) => ids.add(p)));
      ids.add(user.id);
      const results = await Promise.allSettled(
        [...ids].map((id) => usersService.getById(id)),
      );
      if (cancelled) return;
      const map: Record<string, User> = {};
      results.forEach((result) => {
        if (result.status === 'fulfilled') map[result.value.id] = result.value;
      });
      setUserMap(map);
    };

    const unsubscribe = conversationsService.subscribe({
      onData: (convs) => {
        if (cancelled) return;
        setConversations(convs);
        setLoading(false);

        // Deep-link: prioriza la conversación indicada por la URL sobre la
        // primera de la lista, para que "Chatear con el profesional" abra
        // exactamente ese chat y no el más reciente. `userId` sirve cuando
        // todavía no existe conversación entre las dos partes.
        const targeted =
          convs.find((c) => conversationIdParam && c.id === conversationIdParam) ??
          convs.find((c) => jobIdParam && c.jobId === jobIdParam) ??
          convs.find((c) => userIdParam && c.participantIds.includes(userIdParam));
        setActiveConversationId((current) =>
          targeted ? targeted.id : current ?? convs[0]?.id ?? null,
        );

        void loadProfiles(convs);
      },
      onError: (error) => {
        if (cancelled) return;
        toast('error', getErrorMessage(error));
        setLoading(false);
      },
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [user, jobIdParam, conversationIdParam, userIdParam]);

  useEffect(() => {
    if (!activeConversationId || !user) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    const conversationId = activeConversationId;
    const myId = user.id;

    const unsubscribe = messagesService.subscribeToConversation(conversationId, {
      onData: (msgs) => {
        if (cancelled) return;
        setMessages(msgs);
        // El contador se corrige en local para que el badge caiga al abrir,
        // sin esperar el rebote de la escritura de lectura.
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId
              ? { ...c, unreadCount: { ...c.unreadCount, [myId]: 0 } }
              : c,
          ),
        );

        // Marca como leída una sola vez por conversación. Antes se llamaba en
        // cada emisión: escribir en el documento de conversación disparaba
        // otra vez el listener de la lista, que re-suscribía los mensajes y
        // provocaba un bucle de escrituras que ahogaba el tráfico real.
        const lastIncoming = [...msgs].reverse().find((m) => m.senderId !== myId);
        if (
          lastIncoming &&
          markedReadRef.current !== `${conversationId}:${lastIncoming.id}`
        ) {
          markedReadRef.current = `${conversationId}:${lastIncoming.id}`;
          void messagesService.markAsRead(conversationId).catch(() => {
            markedReadRef.current = null;
          });
        }
      },
      onError: (error) => {
        if (!cancelled) toast('error', getErrorMessage(error));
      },
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [activeConversationId, user]);

  const handleSelect = (conversation: Conversation) => {
    setMessages([]);
    setActiveConversationId(conversation.id);
    setSearchParams({ conversationId: conversation.id }, { replace: true });
  };

  const handleSend = async (content: string) => {
    if (!user || !activeConversationId) return;
    const conversation = conversations.find((c) => c.id === activeConversationId);
    if (!conversation) return;
    setSending(true);
    try {
      const otherId = conversation.participantIds.find((id) => id !== user.id);
      if (!otherId) return;
      // El mensaje aparece por la suscripción de Firestore, no por estado
      // local: así el remitente y el destinatario ven exactamente lo mismo.
      await messagesService.send({
        jobId: conversation.jobId,
        receiverId: otherId,
        content,
      });
    } catch (error) {
      toast('error', getErrorMessage(error));
    } finally {
      setSending(false);
    }
  };

  const otherUserId = activeConversation
    ? activeConversation.participantIds.find((id) => id !== user?.id) || ''
    : '';
  const otherUserName = userMap[otherUserId]
    ? `${userMap[otherUserId].profile.firstName} ${userMap[otherUserId].profile.lastName}`.trim()
    : activeConversation?.participantsSnapshot[otherUserId]?.name || '';
  const otherUserAvatar =
    userMap[otherUserId]?.profile.avatarUrl ||
    activeConversation?.participantsSnapshot[otherUserId]?.avatarUrl;

  const resolveName = (conversation: Conversation, fallbackId: string): string => {
    const fromUser = userMap[fallbackId];
    if (fromUser) {
      const full = `${fromUser.profile.firstName} ${fromUser.profile.lastName}`.trim();
      if (full) return full;
    }
    return conversation.participantsSnapshot[fallbackId]?.name || 'Usuario';
  };

  const resolveAvatar = (conversation: Conversation, fallbackId: string): string =>
    userMap[fallbackId]?.profile.avatarUrl ||
    conversation.participantsSnapshot[fallbackId]?.avatarUrl ||
    '';

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
              resolveName={resolveName}
              resolveAvatar={resolveAvatar}
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
            otherUserId={otherUserId || undefined}
            otherUserName={otherUserName || undefined}
            otherUserAvatar={otherUserAvatar || undefined}
            onSend={handleSend}
            sending={sending}
            empty={!activeConversation}
          />
        </div>
      </div>
    </div>
  );
}