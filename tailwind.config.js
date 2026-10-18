/** Tailwind config dla DELFINADA — używany TYLKO do zbudowania pliku CSS. */
module.exports = {
  // Pliki, w których Tailwind szuka użytych klas (żeby wygenerować tylko potrzebne):
  content: ['./index.html'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Nunito', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Baloo 2"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Paleta z logo DELFINADA — TURKUS (baza)
        sky: {
          50:  '#eafafc', 100: '#d2f2f6', 200: '#a6e5ec', 300: '#6fd2dd',
          400: '#33b7c7', 500: '#189aad', 600: '#0e7c8b', 700: '#0b6270',
        },
        // POMARAŃCZ (delfin)
        coral: { light: '#ffb26b', DEFAULT: '#ff8826', dark: '#e5720f' },
        sunny: { light: '#ffc98a', DEFAULT: '#ff9d40', dark: '#f07f1a' },
        // Miętowo-turkusowy akcent
        mint:  { light: '#bdeef0', DEFAULT: '#22b8c0', dark: '#0e9aa2' },
      },
      keyframes: {
        'float':   { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-18px)' } },
        'rise':    { '0%': { transform: 'translateY(0) scale(.6)', opacity: '0' }, '15%': { opacity: '.7' }, '100%': { transform: 'translateY(-140px) scale(1.2)', opacity: '0' } },
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(24px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'wiggle':  { '0%,100%': { transform: 'rotate(-5deg)' }, '50%': { transform: 'rotate(5deg)' } },
        'pop':     { '0%': { transform: 'scale(.9)' }, '60%': { transform: 'scale(1.05)' }, '100%': { transform: 'scale(1)' } },
      },
      animation: {
        'float':   'float 6s ease-in-out infinite',
        'fade-up': 'fade-up .7s ease-out both',
        'wiggle':  'wiggle 3.5s ease-in-out infinite',
        'pop':     'pop .4s ease-out both',
      },
    },
  },
  plugins: [],
};
