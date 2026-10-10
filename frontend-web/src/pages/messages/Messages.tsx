import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useAuthStore } from '@/stores/authStore';
import { conversationsService, messagesService } from '@/api/messages.service';
import { usersService } from '@/api/users.service';
import { jobsService } from '@/api/jobs.service';
import type { Conversation } from '@/types/message.types';
import type { Message } from '@/types/message.types';
import type { User } from '@/types/user.types';
import type { Job } from '@/types/job.types';
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
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [userMap, setUserMap] = useState<Record<string, User>>({});
  const [jobMap, setJobMap] = useState<Record<string, Job>>({});
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

    const loadProfilesAndJobs = async (convs: Conversation[]) => {
      const userIds = new Set<string>();
      const jobIds = new Set<string>();

      convs.forEach((c) => {
        c.participantIds.forEach((p) => userIds.add(p));
        if (c.jobId) jobIds.add(c.jobId);
      });
      userIds.add(user.id);

      const [userResults, jobResults] = await Promise.all([
        Promise.allSettled([...userIds].map((id) => usersService.getById(id))),
        Promise.allSettled([...jobIds].map((id) => jobsService.getById(id)))
      ]);

      if (cancelled) return;

      const uMap: Record<string, User> = {};
      userResults.forEach((result) => {
        if (result.status === 'fulfilled') uMap[result.value.id] = result.value;
      });
      setUserMap(uMap);

      const jMap: Record<string, Job> = {};
      jobResults.forEach((result) => {
        if (result.status === 'fulfilled') jMap[result.value.id] = result.value;
      });
      setJobMap(jMap);
    };

    const unsubscribe = conversationsService.subscribe({
      onData: (convs) => {
        if (cancelled) return;
        setConversations(convs);
        setLoading(false);

        const targeted =
          convs.find((c) => conversationIdParam && c.id === conversationIdParam) ??
          convs.find((c) => jobIdParam && c.jobId === jobIdParam) ??
          convs.find((c) => userIdParam && c.participantIds.includes(userIdParam));
        
        setActiveConversationId((current) =>
          targeted ? targeted.id : current ?? null
        );

        void loadProfilesAndJobs(convs);
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
        
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId
              ? { ...c, unreadCount: { ...c.unreadCount, [myId]: 0 } }
              : c,
          ),
        );

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

  const handleCloseChat = () => {
    setActiveConversationId(null);
    setSearchParams({}, { replace: true });
  };

  const handleSend = async (content: string) => {
    if (!user || !activeConversationId) return;
    const conversation = conversations.find((c) => c.id === activeConversationId);
    if (!conversation) return;
    setSending(true);
    try {
      const otherId = conversation.participantIds.find((id) => id !== user.id);
      if (!otherId) return;
      
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
    const jobId = conversation.jobId;
    const job = jobId ? jobMap[jobId] : undefined;
    const jobTitle = job ? job.details.title : 'Chat de trabajo';

    let userName = conversation.participantsSnapshot[fallbackId]?.name || 'Usuario';
    if (fromUser) {
      const full = `${fromUser.profile.firstName} ${fromUser.profile.lastName}`.trim();
      if (full) userName = full;
    }
    // Sintaxis corregida
    return `${userName} • ${jobTitle}`;
  };

  const resolveAvatar = (conversation: Conversation, fallbackId: string): string =>
    userMap[fallbackId]?.profile.avatarUrl ||
    conversation.participantsSnapshot[fallbackId]?.avatarUrl ||
    '';

  const activeJobTitle = activeConversation?.jobId
    ? jobMap[activeConversation.jobId]?.details?.title || 'Chat de trabajo'
    : 'Chat de trabajo';

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-gray-50/50">
      <div className="mx-auto flex w-full max-w-6xl flex-1 overflow-hidden sm:py-6 sm:px-4">
        
        <div
          className={`w-full bg-white sm:w-[340px] sm:rounded-l-2xl sm:border border-gray-200 sm:shadow-sm ${
            activeConversation ? 'hidden sm:flex sm:flex-col' : 'flex flex-col'
          }`}
        >
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-white sm:rounded-tl-2xl">
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Chats</h1>
            <span className="bg-brand-50 text-brand-700 text-xs font-bold px-2.5 py-1 rounded-full">
              {conversations.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <p className="text-sm font-medium text-gray-400 animate-pulse">Cargando chats...</p>
              </div>
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
        </div>

        <div
          className={`flex-1 sm:rounded-r-2xl sm:border-y sm:border-r border-gray-200 sm:shadow-sm bg-white overflow-hidden ${
            activeConversation ? 'block' : 'hidden sm:block'
          }`}
        >
          <ChatWindow
            messages={messages}
            currentUserId={user?.id || ''}
            otherUserId={otherUserId || undefined}
            otherUserName={otherUserName || undefined}
            otherUserAvatar={otherUserAvatar || undefined}
            jobTitle={activeJobTitle}   
            onSend={handleSend}
            onBack={handleCloseChat}
            onClose={handleCloseChat}    
            sending={sending}
            empty={!activeConversation}
          />
        </div>

      </div>
    </div>
  );
}