import { ClerkProvider } from "@clerk/clerk-react";
import { StrictMode, useEffect, useMemo, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App.tsx";
import "./index.css";

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!clerkPublishableKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY.");
}

function ThemedClerkProvider({ children }: { children: ReactNode }) {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof document === "undefined") {
      return false;
    }

    return document.documentElement.classList.contains("dark");
  });

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDarkMode(root.classList.contains("dark"));
    });

    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const appearance = useMemo(() => {
    return {
      variables: isDarkMode
        ? {
            colorPrimary: "#84d7af",
            colorBackground: "#1c1b1b",
            colorInputBackground: "#201f1f",
            colorInputText: "#e5e2e1",
            colorText: "#e5e2e1",
            colorTextSecondary: "#bec9c1",
            colorNeutral: "#3f4943",
            colorDanger: "#f87171",
            borderRadius: "1rem",
            fontFamily: '"Manrope", sans-serif',
          }
        : {
            colorPrimary: "#006747",
            colorBackground: "#ffffff",
            colorInputBackground: "#f8f9fa",
            colorInputText: "#1a1c1b",
            colorText: "#1a1c1b",
            colorTextSecondary: "#5a605c",
            colorNeutral: "#e2e5e3",
            colorDanger: "#dc2626",
            borderRadius: "1rem",
            fontFamily: '"Manrope", sans-serif',
          },
      elements: {
        card: "shadow-[0_18px_40px_rgba(0,0,0,0.08)] border border-outline-variant/40 bg-surface-container-lowest",
        modalContent: "border border-outline-variant/40 bg-surface-container-lowest",
        headerTitle: "font-headline text-on-surface",
        headerSubtitle: "text-on-surface-variant",
        socialButtonsBlockButton: "border border-outline-variant/40 bg-surface-container-low text-on-surface hover:bg-surface-container",
        formButtonPrimary: "bg-primary text-on-primary hover:brightness-110 shadow-none",
        formFieldInput: "border border-outline-variant/40 bg-surface-container-low text-on-surface",
        footerActionLink: "text-primary hover:text-primary",
        formFieldLabel: "text-on-surface font-semibold",
        identityPreviewText: "text-on-surface",
        identityPreviewEditButton: "text-primary",
        formResendCodeLink: "text-primary",
        otpCodeFieldInput: "border border-outline-variant/40 bg-surface-container-low text-on-surface",
        navbar: "bg-surface-container-lowest border-r border-outline-variant/30",
        navbarButton: "text-on-surface-variant hover:bg-surface-container hover:text-on-surface",
        navbarButtonActive: "bg-primary/10 text-primary",
        pageScrollBox: "bg-transparent",
        profileSectionPrimaryButton: "bg-primary text-on-primary hover:brightness-110",
        profileSectionSecondaryButton: "border border-outline-variant/40 bg-surface-container-low text-on-surface hover:bg-surface-container",
      },
    };
  }, [isDarkMode]);

  return (
    <ClerkProvider publishableKey={clerkPublishableKey} afterSignOutUrl="/" appearance={appearance}>
      {children}
    </ClerkProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemedClerkProvider>
      <App />
    </ThemedClerkProvider>
  </StrictMode>,
);
