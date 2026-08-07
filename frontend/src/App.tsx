/**
 * Root app component: providers + router. Module 9A scope only — the
 * authenticated landing route renders a placeholder, not the real
 * Dashboard (that's Module 9B).
 */
import { BrowserRouter } from "react-router-dom";

import { AppProviders } from "./app/providers";
import { AppRouter } from "./app/router";

function App() {
  return (
    <BrowserRouter>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </BrowserRouter>
  );
}

export default App;
