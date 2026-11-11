/** A same-origin deployment prefix, shared by Vite, Express and the browser. */
export function normalizeAppBase(value = '/') {
  if (!/^\/(?:[A-Za-z0-9._~-]+\/)*[A-Za-z0-9._~-]*$/.test(value) || value.split('/').some(segment => segment === '.' || segment === '..')) {
    throw new Error('APP_BASE_PATH debe ser una ruta local absoluta, sin protocolo, parámetros ni segmentos relativos.');
  }
  return value.endsWith('/') ? value : `${value}/`;
}

export function applicationPaths(base = '/') {
  const home = normalizeAppBase(base);
  return {
    home, app: `${home}app`, logo: `${home}brand/finanzas-mark.svg`,
    preview: `${home}preview/inicio-demo.jpg`, assistant: `${home}api/assistant-chat`,
    parseMovement: `${home}api/parse-movement`,
  };
}

export function isApplicationPath(pathname: string, base = '/') {
  const app = applicationPaths(base).app;
  return pathname === app || pathname === `${app}/`;
}
