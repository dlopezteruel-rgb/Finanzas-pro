export function storageSupportError(secureContext: boolean, webLocksAvailable: boolean): string {
  if (!secureContext) return 'El guardado requiere un contexto seguro: abre la aplicación mediante HTTPS o localhost.';
  if (!webLocksAvailable) return 'Este navegador o contenedor no ofrece Web Locks. El guardado está bloqueado para evitar sobrescrituras; utiliza un navegador actualizado compatible.';
  return '';
}

export function browserStorageSupportError(): string {
  return storageSupportError(globalThis.isSecureContext === true, typeof navigator.locks?.request === 'function');
}
