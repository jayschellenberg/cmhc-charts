import { defineConfig } from 'vitest/config';

// Dedicated config (not the app vite.config) so tests don't load the Tailwind
// plugin. jsdom gives the tab modules a DOM at import time (they pull in Plot /
// html-to-image), even though the functions under test are pure.
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.js'],
  },
});
