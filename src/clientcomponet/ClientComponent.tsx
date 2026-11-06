'use client';

import { StoreProvider } from "./StoreProvider";
import { useSyncExternalStore } from "react";
import { Toaster } from "sonner";

const noSubscribe = () => () => {};

export default function ClientComponent({ children }: { children: React.ReactNode }) {
  // rms.pln.ng keeps page actions at the top right, so its toasts go bottom right
  const onRmsHost = useSyncExternalStore(noSubscribe, () => window.location.hostname.startsWith("rms."), () => false);
  return (
    <StoreProvider>
      {/* All our client-side providers and containers go here */}
      {children}
      <Toaster 
        position={onRmsHost ? "bottom-right" : "top-right"}
        expand={true} 
        richColors 
        closeButton
        visibleToasts={5}
        toastOptions={{
          style: {
            zIndex: 999999
          }
        }}
      />
    </StoreProvider>
  );
}
