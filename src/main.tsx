// global styles first: section stylesheets imported by components must come after them in the cascade
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/motifs.css";
import "./styles/chrome.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { initMotion } from "./lib/motion";
import { loadZone } from "./lib/zone";

initMotion();
// the zone file is tiny and both the hero and the sample map read it: start it now
void loadZone();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
