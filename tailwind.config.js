/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ae: {
          bg: "#1a1a1a",
          "bg-primary": "#1e1e1e",
          "bg-secondary": "#2d2d2d",
          "bg-panel": "#393939",
          panel: "#242424",
          border: "#333333",
          text: "#e8e8e8",
          "text-primary": "#d4d4d4",
          "text-secondary": "#999999",
          muted: "#9a9a9a",
          accent: "#2d8ceb",
        },
      },
    },
  },
  plugins: [],
};
