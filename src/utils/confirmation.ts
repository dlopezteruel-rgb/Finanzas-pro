/** A synchronous guard also blocks repeated clicks before React renders again. */
export function confirmOnce<T>(save: (value: T) => void) {
  let closed = false;
  return {
    confirm(value: T) {
      if (closed) return false;
      closed = true;
      try {
        save(value);
        return true;
      } catch (error) {
        closed = false;
        throw error;
      }
    },
    cancel() { closed = true; },
  };
}
