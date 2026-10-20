import React from "react";
import { hasProviderLogo, type ProviderId } from "../Layout/ConfigurationDialog/providerLogos";
import ProviderAboutDialog from "./ProviderAboutDialog";

type OpenAbout = (provider: ProviderId) => void;

const ProviderAboutContext = React.createContext<OpenAbout | null>(null);

/** One About dialog for the whole app, opened from wherever a provider is shown. */
export function ProviderAboutProvider({ children }: { children: React.ReactNode }) {
  const [provider, setProvider] = React.useState<ProviderId | null>(null);
  return (
    <ProviderAboutContext.Provider value={setProvider}>
      {children}
      <ProviderAboutDialog provider={provider} onClose={() => setProvider(null)} />
    </ProviderAboutContext.Provider>
  );
}

/** Opens a provider's About dialog. Null for a direct upload or an unknown source, which have none, and outside the
 *  provider. */
export function useProviderAbout(provider: string | null | undefined): (() => void) | null {
  const open = React.useContext(ProviderAboutContext);
  if (!open || !hasProviderLogo(provider)) return null;
  return () => open(provider);
}
