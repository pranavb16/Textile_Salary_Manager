import React from "react";
import { createRoot } from "react-dom/client";
import PayrollApp from "./app/PayrollApp.js";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(<React.StrictMode><PayrollApp /></React.StrictMode>);
