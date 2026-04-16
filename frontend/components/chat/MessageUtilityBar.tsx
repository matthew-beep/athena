'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface MessageUtilityBarProps {
  content: string;
}

export function MessageUtilityBar({ content }: MessageUtilityBarProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error('Failed to copy message content:', error);
    }
  };

  return (
    <div className="flex items-center gap-2 px-1">
      <button
        type="button"
        onClick={handleCopy}
        className='text-[var(--t2)] hover:bg-[var(--raised-h)]/90 hover:text-[var(--t1)] p-1 rounded-full transition-all'
        aria-label="Copy message"
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}
