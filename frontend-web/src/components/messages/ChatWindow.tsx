import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Send, MessageSquare, ArrowLeft, ShieldCheck, X } from 'lucide-react';
import type { Message } from '@/types/message.types';
import { MessageBubble } from './MessageBubble';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/utils/cn';

interface ChatWindowProps {
  messages: Message[];
  currentUserId: string;
  otherUserId?: string;
  otherUserName?: string;
  otherUserAvatar?: string;
  jobTitle?: string; 
  onSend: (content: string) => Promise<void>;
  onClose?: () => void; 
  onBack?: () => void;
  sending?: boolean;
  empty?: boolean;
}

export function ChatWindow({
  messages,
  currentUserId,
  otherUserId,
  otherUserName,
  otherUserAvatar,
  jobTitle,
  onSend,
  onClose,
  onBack,
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
      <div className="flex h-full flex-col items-center justify-center bg-gray-50/50 p-8 text-center border-l border-gray-100">
        <div className="mb-6 flex h-28 w-28 items-center justify-center rounded-full bg-brand-50 text-brand-600 shadow-inner">
          <MessageSquare className="h-14 w-14 opacity-80" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Tus Mensajes</h2>
        <p className="mt-3 max-w-sm text-sm text-gray-500 leading-relaxed">
          Selecciona una conversación del panel lateral para comenzar a chatear o contacta a un usuario desde tus trabajos activos.
        </p>
        <div className="mt-8 flex items-center gap-2 text-xs font-medium text-gray-400 bg-white px-4 py-2 rounded-full border border-gray-200 shadow-sm">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          Mensajes cifrados de extremo a extremo
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#F0F2F5] sm:border-l border-gray-200">
      
      {/* ENCABEZADO CON BOTÓN DE CERRAR Y TÍTULO DE TRABAJO */}
      {otherUserName && (
        <div className="flex items-center justify-between bg-white px-4 py-3 shadow-sm z-10">
          <div className="flex items-center gap-3 min-w-0">
            {/* Botón de flecha para regresar en móviles */}
            {(onBack || onClose) && (
              <button 
                onClick={onBack || onClose}
                className="sm:hidden mr-1 p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            
            <Avatar name={otherUserName} src={otherUserAvatar} size="md" className="shadow-sm shrink-0" />
            
            <div className="flex flex-col min-w-0">
              {otherUserId ? (
                <Link
                  to={`/perfil/${otherUserId}`}
                  className="truncate text-base font-bold text-gray-900 transition-colors hover:text-brand-600"
                >
                  {otherUserName}
                </Link>
              ) : (
                <p className="truncate text-base font-bold text-gray-900">{otherUserName}</p>
              )}
              
              {/* Título del Trabajo sin el estado "En línea" */}
              {jobTitle && (
                <div className="flex items-center gap-2 text-[11px] sm:text-xs truncate mt-0.5">
                  <span className="font-semibold text-gray-600 truncate max-w-[200px] sm:max-w-xs">
                    💼 {jobTitle}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Botón X para cerrar en PC */}
          {onClose && (
            <button
              onClick={onClose}
              title="Cerrar chat"
              className="hidden sm:flex p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors shrink-0"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      )}

      {/* ÁREA DE MENSAJES */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-opacity-5">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <EmptyState
              title="Sin mensajes aún"
              description="Envía el primer mensaje para iniciar la conversación."
              icon={<MessageSquare className="h-8 w-8 text-gray-300" />}
            />
          </div>
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

      {/* BARRA DE ESCRITURA */}
      <div className="bg-white px-4 py-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)] z-10">
        <div className="mx-auto flex max-w-4xl items-end gap-2">
          <div className="relative flex-1">
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
              rows={1}
              className="block w-full resize-none rounded-3xl border border-gray-200 bg-gray-100 px-5 py-3.5 text-sm text-gray-900 placeholder:text-gray-500 transition-all focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10 max-h-32 shadow-inner"
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!draft.trim() || sending}
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white shadow-md shadow-brand-600/20',
              'transition-all hover:bg-brand-700 hover:scale-105 active:scale-95',
              'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 disabled:shadow-none',
            )}
          >
            <Send className="h-5 w-5 ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
}