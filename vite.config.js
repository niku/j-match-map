import { defineConfig } from 'vite';

export default defineConfig({
  base: '/j-match-map/',
  esbuild: {
    supported: {
      'top-level-await': true,
    },
  }
});
