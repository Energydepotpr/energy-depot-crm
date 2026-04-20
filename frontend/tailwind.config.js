/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}', './lib/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg:      '#16202c',
        surface: '#1c2d3e',
        border:  '#253b4f',
        accent:  '#1b9af5',
        muted:   '#6a8fa8',
        success: '#00c9a7',
        danger:  '#ff5b5b',
        warning: '#ffbc00',
      },
      fontFamily: {
        sans: ["'PT Sans'", 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
