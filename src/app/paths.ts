import { applicationPaths } from '../../config/appPaths';

// Vite replaces BASE_URL in development and builds. Paths never change DATA_KEY or origin.
export const paths = applicationPaths(import.meta.env?.BASE_URL ?? '/');
