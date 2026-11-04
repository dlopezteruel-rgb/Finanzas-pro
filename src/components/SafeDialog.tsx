import React from 'react';
import { Overlay } from './Overlay';

export function SafeDialog({ title, onCancel, children }: {
  title: string; onCancel: () => void; children: React.ReactNode;
}) {
  return <Overlay title={title} onClose={onCancel}>
    <section role="dialog" aria-modal="true" aria-label={title} className="bg-[#141926] text-white border border-white/10 rounded-2xl p-5 max-w-lg w-full space-y-4 max-h-[90vh] overflow-y-auto shadow-xl">
      <h2 className="text-base font-bold">{title}</h2>
      {children}
    </section>
  </Overlay>;
}
