/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/renderer/settings/**/*.{ts,tsx,html}',
    './src/renderer/appearance/**/*.{ts,tsx,html}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-deep': '#0f0f1a',
        'bg-section': '#1a1a2e',
        'bg-input': '#2a2a3e',
        'accent': '#6060ff',
        'accent-light': '#a0a0ff',
        'accent-dim': '#4040aa',
        'danger': '#ff6060',
      },
    },
  },
  plugins: [],
}
