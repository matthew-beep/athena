 'use client';
 
 import { EllipsisIcon } from 'lucide-react';
 import { useEffect, useId, useRef, useState } from 'react';
 
 type MenuAction = 'rename' | 'delete';
 
 export interface CollectionsListProps {
   collections: string[];
   selectedCollections: string[];
   onSelectCollection: (collection: string) => void;
   onAction?: (collection: string, action: MenuAction) => void;
 }
 
 function useOnClickOutside(
   refs: Array<React.RefObject<HTMLElement>>,
   handler: () => void
 ) {
   useEffect(() => {
     const onPointerDown = (e: PointerEvent) => {
       const target = e.target as Node | null;
       if (!target) return;
       if (refs.some((r) => r.current && r.current.contains(target))) return;
       handler();
     };
     window.addEventListener('pointerdown', onPointerDown);
     return () => window.removeEventListener('pointerdown', onPointerDown);
   }, [refs, handler]);
 }
 
 function CollectionRow({
   collection,
   checked,
   onToggle,
   onAction,
 }: {
   collection: string;
   checked: boolean;
   onToggle: () => void;
   onAction?: (action: MenuAction) => void;
 }) {
   const menuId = useId();
   const [open, setOpen] = useState(false);
   const buttonRef = useRef<HTMLButtonElement>(null);
   const menuRef = useRef<HTMLDivElement>(null);
 
   useOnClickOutside([buttonRef, menuRef], () => setOpen(false));
 
   useEffect(() => {
     if (!open) return;
     const onKeyDown = (e: KeyboardEvent) => {
       if (e.key === 'Escape') setOpen(false);
     };
     window.addEventListener('keydown', onKeyDown);
     return () => window.removeEventListener('keydown', onKeyDown);
   }, [open]);
 
   return (
     <div
       className={[
         'group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
         'hover:bg-[color:var(--border)]/30',
         checked ? 'text-[var(--t1)]' : 'text-[var(--t2)]',
       ].join(' ')}
     >
       <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
         <input
           type="checkbox"
           checked={checked}
           className="doc-sidebar-checkbox"
           onChange={onToggle}
         />
         <span className="truncate group-hover:text-[var(--t1)]">{collection}</span>
       </label>
 
       <div className="relative">
         <button
           ref={buttonRef}
           type="button"
           className={[
             'inline-flex items-center justify-center rounded-md p-1',
             'text-muted-foreground hover:text-[var(--t1)] hover:bg-[color:var(--border)]/30 transition-colors',
             'opacity-0 group-hover:opacity-100 focus:opacity-100',
           ].join(' ')}
           aria-haspopup="menu"
           aria-expanded={open}
           aria-controls={menuId}
           onClick={() => setOpen((v) => !v)}
         >
           <EllipsisIcon className="h-4 w-4" />
         </button>
 
         {open && (
           <div
             ref={menuRef}
             id={menuId}
             role="menu"
             className={[
               'absolute right-0 top-8 z-50 min-w-36 overflow-hidden rounded-md border border-[var(--border)]',
               'bg-[color:var(--panel,#0b0f14)] shadow-lg backdrop-blur',
             ].join(' ')}
           >
             <button
               type="button"
               role="menuitem"
               className="w-full px-3 py-2 text-left text-sm text-[var(--t2)] hover:bg-[color:var(--border)]/30 hover:text-[var(--t1)] transition-colors"
               onClick={() => {
                 setOpen(false);
                 onAction?.('rename');
               }}
             >
               Rename
             </button>
             <button
               type="button"
               role="menuitem"
               className="w-full px-3 py-2 text-left text-sm text-[var(--t2)] hover:bg-[color:var(--border)]/30 hover:text-[var(--t1)] transition-colors"
               onClick={() => {
                 setOpen(false);
                 onAction?.('delete');
               }}
             >
               Delete
             </button>
           </div>
         )}
       </div>
     </div>
   );
 }
 
 export function CollectionsList({
   collections,
   selectedCollections,
   onSelectCollection,
   onAction,
 }: CollectionsListProps) {
   return (
     <div className="flex flex-col gap-1 h-full border-2">
       {collections.map((collection) => (
         <CollectionRow
           key={collection}
           collection={collection}
           checked={selectedCollections.includes(collection)}
           onToggle={() => onSelectCollection(collection)}
           onAction={(action) => onAction?.(collection, action)}
         />
       ))}
     </div>
   );
 }
