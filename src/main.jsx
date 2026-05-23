import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom"; // ← HashRouter pas BrowserRouter
import App from "./App";
import "./styles.css";

const dark = localStorage.getItem('darkMode');

if (dark === 'true') {
  document.body.classList.add('dark-mode');
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);