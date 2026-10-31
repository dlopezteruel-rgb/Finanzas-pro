import { useRef, useState } from 'react';
import { createFormSubmission, SaveResult } from './saveResult';

export function useAsyncForm() {
  const guard = useRef(createFormSubmission());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  return {
    saving, error,
    clearError() { setError(''); },
    close(onClose: () => void) { if (!guard.current.pending) onClose(); },
    async submit(save: () => Promise<SaveResult>, onSuccess: () => void) {
      if (guard.current.pending) return;
      setSaving(true); setError('');
      const result = await guard.current.run(save, onSuccess);
      if (result?.ok === false) setError(result.error);
      setSaving(false);
    },
  };
}
