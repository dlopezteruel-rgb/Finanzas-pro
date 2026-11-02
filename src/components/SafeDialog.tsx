import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export function SafeDialog({ title, onCancel, children }: {
  title: string; onCancel: () => void; children: React.ReactNode;
}) {
  const panel = useRef<HTMLElement>(null);
  const cancel = useRef(onCancel);
  cancel.current = onCancel;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); cancel.current(); }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') ?? []);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, []);
  return createPortal(<div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
    <section ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="bg-[#141926] text-white border border-white/10 rounded-2xl p-5 max-w-lg w-full space-y-4 max-h-[90vh] overflow-y-auto shadow-xl">
      <h2 className="text-base font-bold">{title}</h2>
      {children}
    </section>
  </div>, document.body);
}
