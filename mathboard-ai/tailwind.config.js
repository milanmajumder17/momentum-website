/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Hind Siliguri"', '"Noto Sans Bengali"', 'sans-serif'],
        handwriting: ['Kalam', 'Caveat', 'cursive'],
      },
    },
  },
  plugins: [],
}