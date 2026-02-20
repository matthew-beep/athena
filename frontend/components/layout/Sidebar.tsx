'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  PlusCircle,
  Plus,
  MessageSquare,
  Search,
  Network,
  BookOpen,
  FileText,
  Settings,
  LogOut,
  ChevronLeft,
  X,
} from 'lucide-react';
import { useChatStore } from '@/stores/chat.store';
import { useAuthStore } from '@/stores/auth.store';
import { useUIStore } from '@/stores/ui.store';
import { apiClient } from '@/api/client';
import { cn } from '@/utils/cn';
import type { Conversation, Message } from '@/types';

const NAV_ITEMS = [
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/research', label: 'Research', icon: Search },
  { href: '/graph', label: 'Knowledge', icon: Network },
  { href: '/quizzes', label: 'Quizzes', icon: BookOpen },
  { href: '/documents', label: 'Documents', icon: FileText },
  { href: '/settings', label: 'Settings', icon: Settings },
];

interface SidebarContentProps {
  collapsed: boolean;
  isMobileDrawer?: boolean;
  onClose?: () => void;
}

function SidebarContent({ collapsed, isMobileDrawer, onClose }: SidebarContentProps) {
  const pathname = usePathname();
  const { logout, user } = useAuthStore();
  const { toggleSidebarCollapsed } = useUIStore();
  const {
    conversations,
    setConversations,
    activeConversationId,
    setActiveConversation,
    setMessages,
  } = useChatStore();

  useEffect(() => {
    apiClient
      .get<Conversation[]>('/chat/conversations')
      .then(setConversations)
      .catch(console.error);
  }, [setConversations]);

  const handleSelectConversation = async (conv: Conversation) => {
    setActiveConversation(conv.conversation_id);
    if (onClose) onClose();
    try {
      const msgs = await apiClient.get<Message[]>(
        `/chat/conversations/${conv.conversation_id}/messages`
      );
      setMessages(conv.conversation_id, msgs);
    } catch (e) {
      console.error(e);
    }
  };

  const handleNewChat = () => {
    setActiveConversation(null);
    if (onClose) onClose();
  };

  const isOnChat = pathname.startsWith('/chat');

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className={cn('border-b border-border/30', collapsed ? 'px-2 py-4' : 'px-4 py-4')}>
        <div className={cn('flex items-center mb-4', collapsed ? 'justify-center' : 'gap-2.5')}>
          <div className="w-6 h-6 rounded-lg bg-foreground/10 border border-foreground/20 flex items-center justify-center flex-shrink-0">
            <span className="text-foreground text-xs font-bold font-display">A</span>
          </div>
          {!collapsed && (
            <span className="font-display font-semibold text-sm tracking-tight">Athena</span>
          )}
          {isMobileDrawer && (
            <button
              onClick={onClose}
              className="ml-auto p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Main navigation */}
        <nav className="space-y-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            if (collapsed) {
              return (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  className={cn(
                    'flex items-center justify-center p-2 border-l-2 transition-colors',
                    active
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon size={15} />
                </Link>
              );
            }
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={cn('nav-item', active && 'active')}
              >
                <Icon size={13} className="flex-shrink-0" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Conversation list — visible when on /chat and not collapsed */}
      {isOnChat && !collapsed && (
        <div className="flex flex-col flex-1 overflow-hidden border-b border-border/30">
          <div className="px-3 pt-3 pb-2">
            <button
              onClick={handleNewChat}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors"
            >
              <PlusCircle size={12} />
              New conversation
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
            {conversations.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6 px-2">
                No conversations yet
              </p>
            )}
            {conversations.map((conv) => (
              <button
                key={conv.conversation_id}
                onClick={() => handleSelectConversation(conv)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-lg text-xs transition-all flex items-start gap-2',
                  activeConversationId === conv.conversation_id
                    ? 'text-foreground border-l-2 border-primary pl-[10px]'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                )}
              >
                <MessageSquare size={11} className="mt-0.5 shrink-0 opacity-50" />
                <span className="truncate leading-tight">
                  {conv.title ?? 'Untitled'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Collapsed: new chat icon button */}
      {isOnChat && collapsed && (
        <div className="flex justify-center py-3 border-b border-border/30">
          <button
            onClick={handleNewChat}
            title="New conversation"
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
          >
            <Plus size={14} />
          </button>
        </div>
      )}

      {/* Spacer */}
      {!isOnChat && <div className="flex-1" />}
      {isOnChat && collapsed && <div className="flex-1" />}

      {/* Collapse toggle — desktop only */}
      {!isMobileDrawer && (
        <div className={cn('border-t border-border/20', collapsed ? 'flex justify-center px-2 py-2' : 'px-3 py-2')}>
          <button
            onClick={toggleSidebarCollapsed}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronLeft
              size={14}
              className={cn('transition-transform duration-200', collapsed && 'rotate-180')}
            />
          </button>
        </div>
      )}

      {/* Footer */}
      <div className={cn('py-3', collapsed ? 'px-2' : 'px-3')}>
        <div className={cn('flex items-center', collapsed ? 'justify-center' : 'justify-between')}>
          {!collapsed && (
            <span className="text-xs text-muted-foreground font-mono">{user?.username}</span>
          )}
          <button
            onClick={logout}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
            title="Logout"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const { sidebarCollapsed, sidebarOpen, setSidebarOpen } = useUIStore();

  return (
    <>
      {/* Desktop / Tablet sidebar */}
      <div
        className={cn(
          'hidden md:flex h-full flex-col glass-subtle border-r border-border/50 flex-shrink-0 transition-all duration-200',
          sidebarCollapsed ? 'w-14' : 'w-60'
        )}
      >
        <SidebarContent collapsed={sidebarCollapsed} />
      </div>

      {/* Mobile drawer */}
      {sidebarOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/60 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          {/* Drawer */}
          <div className="fixed inset-y-0 left-0 z-50 w-72 md:hidden glass-strong border-r border-border/50 animate-shutter">
            <SidebarContent
              collapsed={false}
              isMobileDrawer
              onClose={() => setSidebarOpen(false)}
            />
          </div>
        </>
      )}
    </>
  );
}
