/**
 * Root app component — scaffolding only.
 *
 * No routing/pages/auth are wired up yet (Module 8 builds the reusable UI
 * component library only). This just confirms the frontend boots, the
 * design system loads correctly, and app-wide providers (Toast) are wired.
 */
import { AppProviders } from "./app/providers";
import { Heading, Text } from "./components/ui/Typography";

function App() {
  return (
    <AppProviders>
      <div className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-canvas px-6 text-center">
        <Heading level="h1">Intend Link Saver</Heading>
        <Text variant="body-lg">Frontend scaffold is running. No pages implemented yet.</Text>
      </div>
    </AppProviders>
  );
}

export default App;
