import { createRoot } from "react-dom/client";
import App from "./App";

// Vérifier que l'élément root existe
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

// Créer et gérer le root de manière sécurisée
let root: ReturnType<typeof createRoot> | null = null;

function renderApp() {
  if (!root) {
    root = createRoot(rootElement as HTMLElement);
  }
  root.render(<App />);
}

// Rendu initial
renderApp();

// Hot Module Replacement (HMR) pour le développement
if (import.meta.hot) {
  import.meta.hot.accept("./App", () => {
    console.log("🔄 HMR: App component updated");
    renderApp();
  });

  import.meta.hot.accept("./components/AppContent", () => {
    console.log("🔄 HMR: AppContent component updated");
    renderApp();
  });
}
