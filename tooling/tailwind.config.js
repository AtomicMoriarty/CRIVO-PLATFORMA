// Config do build estático do Tailwind (substitui o cdn.tailwindcss.com).
// Espelha o tema que vivia inline no <head> do app/index.html.
// Rebuild: npx -y tailwindcss@3.4.14 -c tooling/tailwind.config.js -i tooling/tailwind.css -o app/assets/tailwind.css --minify
module.exports = {
  content: ["./app/index.html"],
  theme: {
    extend: {
      colors: {
        brand: "#C8963A",
        navy: "#0A1420",
        gold: "#C8963A",
        success: "#3DB882",
        warning: "#E0913A",
        danger: "#E05252",
      },
      fontFamily: {
        sans: ["IBM Plex Sans", "sans-serif"],
        serif: ["Playfair Display", "serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
    },
  },
};
