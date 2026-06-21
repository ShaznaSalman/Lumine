export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'lumine-purple': '#7F77DD',
        'lumine-pink': '#F4BDD9',
        'lumine-green': '#A8DEC1',
        'lumine-yellow': '#F5DFA0',
        'lumine-peach': '#F5C0A8',
        'lumine-teal': '#9FD9D4',
        'lumine-blue': '#A7CCEF',
        'lumine-rose': '#F5B8C4',
        'lumine-lavender': '#C9B8F7'
      },
      boxShadow: {
        soft: '0 18px 45px rgba(127, 119, 221, 0.12)'
      },
      fontFamily: {
        sans: ['Nunito', 'ui-sans-serif', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
