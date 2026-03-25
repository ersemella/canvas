/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_MANIFESTS_BASE_URL?: string;
}

declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}
