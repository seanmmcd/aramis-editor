/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ae: {
          bg: "var(--ae-bg)",
          "bg-primary": "var(--ae-bg-primary)",
          "bg-secondary": "var(--ae-bg-secondary)",
          "bg-panel": "var(--ae-bg-panel)",
          panel: "var(--ae-panel)",
          border: "var(--ae-border)",
          text: "var(--ae-text)",
          "text-primary": "var(--ae-text-primary)",
          "text-secondary": "var(--ae-text-secondary)",
          muted: "var(--ae-muted)",
          accent: "var(--ae-accent)",
          highlight: "var(--ae-highlight)",
          selection: "var(--ae-selection-bg)",
        },
      },
    },
  },
  plugins: [],
};
