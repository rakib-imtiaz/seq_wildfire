import { lazy, Suspense, useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import Home from "./pages/Home";

const Proposal = lazy(() => import("./pages/Proposal"));
const NotFound = lazy(() => import("./pages/NotFound"));

/** Scroll to the hash target after route changes; otherwise to the top. */
function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const id = decodeURIComponent(hash.slice(1));
      let tries = 0;
      const go = () => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ block: "start" });
        else if (tries++ < 20) window.setTimeout(go, 50);
      };
      go();
      return;
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export default function App() {
  return (
    <>
      <a href="#main" className="skip">
        Skip to content
      </a>
      <ScrollManager />
      <Header />
      <main id="main" tabIndex={-1}>
        <Suspense fallback={<div className="route-fallback" />}>
          <Routes>
            <Route path="/v1" element={<Home />} />
            <Route path="/proposal" element={<Proposal />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
