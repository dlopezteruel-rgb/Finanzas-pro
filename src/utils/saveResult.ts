export type SaveResult = { ok: true } | { ok: false; error: string };
export type SaveCallback<T> = (value: T) => Promise<SaveResult>;

export function saveErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'QuotaExceededError') return 'No hay espacio disponible en el almacenamiento del navegador. Los datos anteriores se conservan.';
    if (error.name === 'SecurityError' || error.name === 'NotAllowedError') return 'El navegador o el contenedor no permite acceder al almacenamiento o a Web Locks. Comprueba los permisos y utiliza HTTPS.';
    return error.message;
  }
  return 'No se pudo guardar. Los datos anteriores se conservan.';
}

/** The guard changes synchronously, before any React render or pending promise. */
export function createFormSubmission() {
  let pending = false;
  return {
    get pending() { return pending; },
    async run(save: () => Promise<SaveResult>, onSuccess: () => void): Promise<SaveResult | null> {
      if (pending) return null;
      pending = true;
      try {
        const result = await save();
        if (result.ok) onSuccess();
        return result;
      } catch (error) { return { ok: false, error: saveErrorMessage(error) }; }
      finally { pending = false; }
    },
  };
}
