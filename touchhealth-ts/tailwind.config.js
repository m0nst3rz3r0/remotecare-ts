/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        teal: {
          DEFAULT: '#0d6e87',
          2: '#1a8fa8',
          3: '#2ab5d4',
          pale: '#e4f6fb',
          ultra: '#f0fafc',
        },
        ink: {
          DEFAULT: '#0f1f26',
          2: '#2a4a58',
          3: '#4a7a8a',
        },
      },
      fontFamily: {
        syne: ['Syne', 'sans-serif'],
        karla: ['Karla', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
