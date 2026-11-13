import React, { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

type Level = 'panel' | 'dialog';
type Entry = { node: HTMLDivElement; content: HTMLElement; level: Level; order: number; close: () => void; previous: HTMLElement | null; ancestors: HTMLElement[] };
const levels: Record<Level, number> = { panel: 100, dialog: 200 };
let sequence = 0;
const entries: Entry[] = [];
let restoreBackground: (() => void) | undefined;
const top = () => [...entries].sort((a, b) => levels[a.level] - levels[b.level] || a.order - b.order).at(-1);
const focusable = (entry: Entry) => Array.from(entry.content.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href],[tabindex]'))
  .filter(el => el.tabIndex >= 0 && !el.matches(':disabled') && !el.closest('[inert]') && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden');
function focus(entry: Entry) {
  const target = entry.content.querySelector<HTMLElement>('[data-autofocus]');
  (target && !target.matches(':disabled') ? target : entry.content).focus({ preventScroll: true });
}
function synchronize() {
  const active = top();
  if (active) document.getElementById('root')?.setAttribute('aria-hidden', 'true');
  const byLevel = new Map<Level, number>();
  for (const entry of [...entries].sort((a, b) => a.order - b.order)) {
    const offset = byLevel.get(entry.level) ?? 0; byLevel.set(entry.level, offset + 1);
    entry.node.style.zIndex = String(levels[entry.level] + offset);
    entry.node.inert = entry !== active;
    if (entry === active) entry.node.removeAttribute('aria-hidden'); else entry.node.setAttribute('aria-hidden', 'true');
    entry.content.setAttribute('aria-modal', entry === active ? 'true' : 'false');
  }
}
function keydown(event: KeyboardEvent) {
  const entry = top();
  if (!entry || event.defaultPrevented) return;
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); entry.close(); return; }
  if (event.key !== 'Tab') return;
  const elements = focusable(entry), first = elements[0], last = elements.at(-1);
  if (!first) { event.preventDefault(); entry.content.focus(); return; }
  if (event.shiftKey && (document.activeElement === first || !elements.includes(document.activeElement as HTMLElement))) { event.preventDefault(); last!.focus(); }
  else if (!event.shiftKey && (document.activeElement === last || !elements.includes(document.activeElement as HTMLElement))) { event.preventDefault(); first.focus(); }
}
function focusin(event: FocusEvent) {
  const entry = top();
  if (entry && !entry.content.contains(event.target as Node)) focus(entry);
}
function lockBackground() {
  const root = document.getElementById('root');
  const inert = root?.inert, hidden = root?.getAttribute('aria-hidden');
  const overflow = document.body.style.overflow, padding = document.body.style.paddingRight;
  const gap = window.innerWidth - document.documentElement.clientWidth;
  if (root) root.inert = true;
  document.body.style.overflow = 'hidden';
  if (gap > 0) document.body.style.paddingRight = `${gap}px`;
  document.addEventListener('keydown', keydown);
  document.addEventListener('focusin', focusin);
  restoreBackground = () => {
    if (root) { root.inert = inert ?? false; if (hidden === null) root.removeAttribute('aria-hidden'); else if (hidden !== undefined) root.setAttribute('aria-hidden', hidden); }
    document.body.style.overflow = overflow; document.body.style.paddingRight = padding;
    document.removeEventListener('keydown', keydown); document.removeEventListener('focusin', focusin);
  };
}

/** Shared hierarchy: contextual drawers below action dialogs, independent of App render order. */
export function Overlay({ children, onClose, title, level = 'dialog' }: {
  children: React.ReactNode; onClose: () => void; title: string; level?: Level;
}) {
  const node = useRef<HTMLDivElement>(null), close = useRef(onClose);
  close.current = onClose;
  useLayoutEffect(() => {
    const wrapper = node.current!;
    const content = wrapper.querySelector<HTMLElement>('[role="dialog"]') ?? wrapper.firstElementChild as HTMLElement;
    const previous = document.activeElement as HTMLElement | null;
    content.setAttribute('role', 'dialog'); content.setAttribute('aria-label', title); content.tabIndex = -1;
    if (!entries.length) lockBackground();
    const ancestors = [...entries].reverse().flatMap(e => e.previous ? [e.previous] : []);
    const entry: Entry = { node: wrapper, content, level, order: ++sequence, close: () => close.current(), previous, ancestors };
    entries.push(entry); if (top() === entry) focus(entry); synchronize();
    return () => {
      const wasTop = top() === entry;
      entries.splice(entries.indexOf(entry), 1); synchronize();
      if (!entries.length) { restoreBackground?.(); restoreBackground = undefined; }
      if (wasTop) {
        const active = top();
        const restoreFocus = () => {
          const target = [entry.previous, ...entry.ancestors].find(el => el?.isConnected && el !== document.body && !el.closest('[inert]') && (!active || active.content.contains(el)));
          if (target) target.focus({ preventScroll: true });
          else if (active) focus(active);
          else Array.from(document.querySelectorAll<HTMLElement>('#root [aria-current="page"]')).find(el => el.getClientRects().length)?.focus({ preventScroll: true });
        };
        restoreFocus();
        // React can restore the old selection after layout cleanup. A deleted
        // opener then leaves focus on body; repair it after the commit finishes.
        queueMicrotask(() => {
          if (top() === active && (active ? !active.content.contains(document.activeElement) : document.activeElement === document.body)) restoreFocus();
        });
      }
    };
  }, [level]);
  // A translated title is presentation, not a new overlay session. Keep focus,
  // pending fields, stacking order and the original opener while it changes.
  useLayoutEffect(() => {
    const wrapper = node.current!;
    const content = wrapper.querySelector<HTMLElement>('[role="dialog"]') ?? wrapper.firstElementChild as HTMLElement;
    content.setAttribute('aria-label', title);
  }, [title]);
  return createPortal(<div ref={node} data-overlay-level={level}
    className={level === 'panel'
      ? 'fixed inset-0 flex justify-end bg-black/10'
      : 'fixed inset-0 flex items-center justify-center bg-black/20 p-3 sm:p-4'}>
    {children}
  </div>, document.body);
}
