/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#fdfaf4',
          100: '#faf4e4',
          200: '#f4e8c9',
        },
        forest: {
          50: '#eef4ee',
          100: '#d4e8d4',
          400: '#5a9a5a',
          600: '#2d6a2d',
          700: '#1e4d1e',
          800: '#163816',
          900: '#0f280f',
        },
        terra: {
          100: '#f5e0d0',
          300: '#d9956a',
          500: '#c0622a',
          700: '#8a3e15',
        },
        stone: {
          warm: '#8c7b6b',
        }
      },
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        body: ['var(--font-body)', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        'soft': '0 2px 20px rgba(0,0,0,0.06)',
        'card': '0 4px 32px rgba(0,0,0,0.08)',
        'elevated': '0 8px 40px rgba(0,0,0,0.12)',
      }
    },
  },
  plugins: [],
}
