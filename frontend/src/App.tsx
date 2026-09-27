import { useState } from "react";
import HomePage from "./pages/HomePage";
import MapPage from "./pages/MapPage";

type Page = "home" | "map";

// Dev shortcut: ?source=fixture skips the home page and loads a fixture directly
const _params = new URLSearchParams(window.location.search);
const INITIAL_PAGE: Page = _params.has("source") ? "map" : "home";

export default function App() {
  const [page, setPage] = useState<Page>(INITIAL_PAGE);

  if (page === "map") {
    return (
      <MapPage
        onNavigateHome={() => setPage("home")}
      />
    );
  }

  return (
    <HomePage
      onNavigate={() => setPage("map")}
    />
  );
}
