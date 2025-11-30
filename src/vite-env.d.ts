declare module '*.svelte' {
  export { SvelteComponent as default } from 'svelte';
}

declare module '*?worker' {
  const workerConstructor: {
    new (): Worker;
  };
  export default workerConstructor;
}
