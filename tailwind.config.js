/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        paper: 'var(--paper)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        line: 'var(--line)',
        ink: 'var(--ink)',
        'ink-2': 'var(--ink-2)',
        'ink-3': 'var(--ink-3)',
        cobalt: 'var(--cobalt)',
        'cobalt-hover': 'var(--cobalt-hover)',
        live: 'var(--live)',
        amber: 'var(--amber)',
        'amber-bg': 'var(--amber-bg)',
        done: 'var(--done)',
        'done-bg': 'var(--done-bg)',
      },
      fontFamily: {
        sans: ['"Instrument Sans"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      fontSize: {
        'scale-12': ['12px', '16px'],
        'scale-13': ['13px', '18px'],
        'scale-15': ['15px', '22px'],
        'scale-16': ['16px', '24px'],
        'scale-21': ['21px', '30px'],
        'scale-28': ['28px', '36px'],
        'scale-40': ['40px', '48px'],
      },
      borderRadius: {
        panel: '20px',
        control: '12px',
      },
    },
  },
  plugins: [],
};
