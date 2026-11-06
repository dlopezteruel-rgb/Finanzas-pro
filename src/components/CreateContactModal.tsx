import { Overlay } from './Overlay';
import { SaveResult } from '../utils/saveResult';
import { useAsyncForm } from '../utils/useAsyncForm';
import React, { useState, useEffect } from 'react';
import { Contact } from '../types/finance';
import { X, UserPlus, Check } from 'lucide-react';

interface CreateContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveContact: (contact: Contact) => Promise<SaveResult>;
  contactToEdit?: Contact | null;
}

const AVATAR_COLORS = [
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-pink-500 to-rose-600',
  'from-purple-500 to-violet-600',
  'from-amber-500 to-orange-600',
  'from-cyan-500 to-blue-600',
];

export const CreateContactModal: React.FC<CreateContactModalProps> = ({
  isOpen,
  onClose,
  onSaveContact,
  contactToEdit,
}) => {
  const submission = useAsyncForm();
  const [name, setName] = useState('');
  const [phoneOrEmail, setPhoneOrEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [color, setColor] = useState(AVATAR_COLORS[0]);

  useEffect(() => {
    submission.clearError();
    if (contactToEdit) {
      setName(contactToEdit.name || '');
      setPhoneOrEmail(contactToEdit.phoneOrEmail || '');
      setNotes(contactToEdit.notes || '');
      setColor(contactToEdit.avatarColor || AVATAR_COLORS[0]);
    } else {
      setName('');
      setPhoneOrEmail('');
      setNotes('');
      setColor(AVATAR_COLORS[0]);
    }
  }, [contactToEdit?.id, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const contact: Contact = {
      id: contactToEdit?.id || `contact-${Date.now()}`,
      name: name.trim(),
      phoneOrEmail: phoneOrEmail.trim() || undefined,
      notes: notes.trim() || undefined,
      avatarColor: color,
      createdAt: contactToEdit?.createdAt || new Date().toISOString().split('T')[0],
    };

    void submission.submit(() => onSaveContact(contact), onClose);
  };

  return (
    <Overlay title="Contacto" onClose={() => submission.close(onClose)}>
      <div role="dialog" aria-modal="true" aria-label="Contacto" className="bg-[#141926] border border-white/10 rounded-3xl max-w-sm w-full p-5 shadow-2xl text-xs space-y-3.5">
        <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">
              {contactToEdit ? 'Editar Contacto' : 'Nuevo Contacto'}
            </h3>
          </div>
          <button
            onClick={() => submission.close(onClose)} disabled={submission.saving}
            className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} aria-busy={submission.saving}>
          <fieldset disabled={submission.saving} className="space-y-3">
          {submission.error && <p role="alert" className="text-amber-300">{submission.error}</p>}
          {submission.saving && <p role="status" className="text-sky-300">Guardando…</p>}
          {/* Contact Avatar Preview */}
          <div className="flex items-center justify-center py-2">
            <div
              className={`w-14 h-14 rounded-full bg-gradient-to-tr ${color} flex items-center justify-center text-white font-bold text-xl shadow-lg ring-2 ring-white/10`}
            >
              {name.trim() ? name.trim().slice(0, 2).toUpperCase() : '?'}
            </div>
          </div>

          {/* Color Picker */}
          <div className="flex items-center justify-center gap-2 pb-1">
            {AVATAR_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full bg-gradient-to-tr ${c} cursor-pointer transition-transform ${
                  color === c ? 'scale-125 ring-2 ring-white' : 'opacity-70 hover:opacity-100'
                }`}
                aria-label="Elegir color de avatar"
              />
            ))}
          </div>

          {/* Name Field */}
          <div className="space-y-1">
            <label className="text-slate-400 font-semibold block text-[11px]">
              Nombre o alias <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ej. Carlos Ruiz"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-[#0c0f17] text-white rounded-xl px-3 py-2 border border-white/10 focus:outline-none focus:border-sky-500 text-xs"
            />
          </div>

          {/* Phone or Email */}
          <div className="space-y-1">
            <label className="text-slate-400 font-semibold block text-[11px]">
              Teléfono, Bizum o Email (opcional)
            </label>
            <input
              type="text"
              placeholder="Ej. +34 600 000 000 / carlos@email.com"
              value={phoneOrEmail}
              onChange={e => setPhoneOrEmail(e.target.value)}
              className="w-full bg-[#0c0f17] text-white rounded-xl px-3 py-2 border border-white/10 focus:outline-none focus:border-sky-500 text-xs"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-slate-400 font-semibold block text-[11px]">
              Notas (opcional)
            </label>
            <input
              type="text"
              placeholder="Ej. Compañero de piso, cenas, viajes..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-[#0c0f17] text-white rounded-xl px-3 py-2 border border-white/10 focus:outline-none focus:border-sky-500 text-xs"
            />
          </div>

          {/* Submit */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              type="button"
              onClick={() => submission.close(onClose)} disabled={submission.saving}
              className="py-2 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 font-semibold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="py-2 px-3 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-sky-500/20 transition-colors cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Guardar</span>
            </button>
          </div>
          </fieldset>
        </form>
      </div>
    </Overlay>
  );
};
