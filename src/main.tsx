import { applyAppearance, DEFAULT_HIGHLIGHT_COLOR } from "@/lib/theme";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "@/App";
import "@/index.css";

applyAppearance({
  theme_mode: "dark",
  highlight_color: DEFAULT_HIGHLIGHT_COLOR,
  text_color: "",
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
