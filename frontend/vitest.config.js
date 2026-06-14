import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: '.',
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['frontend/tests/**/*.test.js'],
    alias: {
      '@': '/Users/wansong/Desktop/chat-book/frontend'
    }
  }
});
