'use client';

import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/utils/cn';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Optional title; when provided, a header with title and close button is rendered */
  title?: React.ReactNode;
  /** Main content of the modal */
  children: React.ReactNode;
  /** Optional footer (e.g. actions) */
  footer?: React.ReactNode;
  /** Max width class for the panel (default: max-w-md) */
  maxWidth?: string;
  /** Additional class for the panel */
  className?: string;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidth = 'max-w-md',
  className,
}: ModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 glass-overlay"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? 'modal-title' : undefined}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            key="modal-panel"
            className={cn(
              'glass-modal w-full overflow-hidden',
              maxWidth,
              className
            )}
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            {title != null && (
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                <h2 id="modal-title" className="text-sm font-semibold text-[var(--t1)]" style={{ fontFamily: 'var(--fd)' }}>
                  {title}
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-[var(--t2)] hover:text-[var(--t1)] hover:bg-[var(--raised)] transition-colors"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>
            )}
            <div>{children}</div>
            {footer != null && (
              <div className="p-2 border-t border-[var(--border)]">{footer}</div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
