import React from "react";
import { createRoot } from "react-dom/client";
import PayrollApp from "./app/PayrollApp.js";
import "./styles/index.css";

// Native number inputs step their value when scrolled while focused. Blur before
// the browser handles the wheel event so touchpad scrolling keeps its value.
document.addEventListener("wheel", () => {
  const active = document.activeElement;
  if (active instanceof HTMLInputElement && active.type === "number") active.blur();
}, { capture: true, passive: true });

createRoot(document.getElementById("root")!).render(<React.StrictMode><PayrollApp /></React.StrictMode>);
