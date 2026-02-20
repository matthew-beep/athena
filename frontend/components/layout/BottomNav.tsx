'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  MessageSquare,
  Search,
  Network,
  BookOpen,
  FileText,
  Settings,
} from 'lucide-react';
import { cn } from '@/utils/cn';

const NAV_ITEMS = [
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/research', label: 'Research', icon: Search },
  { href: '/graph', label: 'Graph', icon: Network },
  { href: '/quizzes', label: 'Quizzes', icon: BookOpen },
  { href: '/documents', label: 'Docs', icon: FileText },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden glass-strong border-t border-border/30 h-16 flex items-center">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-[10px] font-mono transition-colors',
              active
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground/70'
            )}
          >
            <Icon
              size={18}
              className={cn(
                'transition-colors',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
