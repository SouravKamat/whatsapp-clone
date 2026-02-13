/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'primary': '#33e67a',
        'background-light': '#f6f8f7',
        'background-dark': '#112117',
        'danger': '#ff4d4d',
      },
      fontFamily: {
        'display': ['Be Vietnam Pro', 'sans-serif'],
      },
      borderRadius: {
        'DEFAULT': '1rem',
        'lg': '2rem',
        'xl': '3rem',
        'full': '9999px',
      },
    },
  },
  plugins: [],
}
