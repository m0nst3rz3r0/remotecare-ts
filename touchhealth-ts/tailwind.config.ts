import type { Config } from 'tailwindcss';

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        teal: {
          DEFAULT: '#0d6e87',
          2:       '#1a8fa8',
          3:       '#2ab5d4',
          pale:    '#e4f6fb',
          ultra:   '#f0fafc',
        },
        ink: {
          DEFAULT: '#0f1f26',
          2:       '#005469',
          3:       '#0d6e87',
        },
        brand: {
          dark:    '#132b31',
          emerald: '#10b981',
          bg:      '#f8fafc',
        },
      },
      fontFamily: {
        // All three aliases now point to Inter so legacy
        // class names (font-syne, font-karla) still compile
        sans:  ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        syne:  ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        karla: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono:  ['ui-monospace', 'Cascadia Code', 'Source Code Pro', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
