/** Images imported from source resolve to their URL (Vite bundles them). */
declare module '*.png' {
  const url: string;
  export default url;
}
