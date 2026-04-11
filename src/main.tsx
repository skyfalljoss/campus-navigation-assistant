import { ClerkProvider } from "@clerk/clerk-react";
import { StrictMode, useEffect, useMemo, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App.tsx";
import "./index.css";
import { initializeThemePreference } from "./lib/preferences";

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!clerkPublishableKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY.");
}

const cleanupThemePreference = initializeThemePreference();

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
        rootBox: "text-on-surface",
        card: "overflow-hidden rounded-[1.9rem] border border-outline-variant/35 bg-surface-container-lowest/95 text-on-surface shadow-[0_22px_54px_rgba(10,20,16,0.18)] backdrop-blur-xl dark:border-primary/10 dark:bg-surface-container-lowest/92 dark:shadow-[0_28px_72px_rgba(0,0,0,0.48)]",
        modalBackdrop: "bg-[rgba(8,12,10,0.56)] backdrop-blur-md",
        modalContent: "overflow-hidden rounded-[1.9rem] border border-outline-variant/35 bg-surface-container-lowest/95 text-on-surface shadow-[0_24px_64px_rgba(10,20,16,0.22)] backdrop-blur-xl dark:border-primary/10 dark:bg-surface-container-lowest/92 dark:shadow-[0_30px_84px_rgba(0,0,0,0.52)]",
        userButtonPopoverCard: "overflow-hidden rounded-[1.7rem] border border-outline-variant/30 bg-surface-container-lowest/96 text-on-surface shadow-[0_20px_48px_rgba(10,20,16,0.18)] backdrop-blur-xl dark:border-primary/10 dark:bg-surface-container-lowest/94 dark:shadow-[0_24px_56px_rgba(0,0,0,0.45)]",
        userButtonPopoverMain: "bg-surface-container-lowest",
        userPreview: "bg-surface-container-lowest/80",
        userPreviewMainIdentifier: "text-on-surface font-semibold",
        userPreviewSecondaryIdentifier: "text-on-surface-variant",
        headerTitle: "font-headline text-on-surface",
        headerSubtitle: "text-on-surface-variant",
        socialButtonsBlockButton: "min-h-13 rounded-2xl border border-outline/50 bg-surface-container/95 !text-on-surface hover:bg-surface-container-high shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors dark:border-outline/70 dark:bg-[#2e2d2d] dark:hover:bg-[#353434] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        socialButtonsBlockButtonText: "!text-on-surface font-semibold opacity-100",
        socialButtonsIconButton: "border border-outline/50 bg-surface-container/95 !text-on-surface hover:bg-surface-container-high dark:border-outline/70 dark:bg-[#2e2d2d] dark:hover:bg-[#353434]",
        socialButtonsProviderIcon: "text-on-surface",
        formButtonPrimary: "rounded-2xl bg-primary text-on-primary hover:brightness-110 shadow-[0_10px_24px_rgba(0,103,71,0.18)] dark:shadow-[0_12px_28px_rgba(132,215,175,0.18)]",
        formButtonReset: "text-primary hover:text-primary",
        formFieldLabel: "text-on-surface font-semibold",
        formFieldInput: "rounded-2xl border border-outline/50 bg-surface-container/95 !text-on-surface placeholder:!text-on-surface-variant/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] focus:border-primary focus:ring-0 dark:border-outline-variant/70 dark:bg-surface-container-high/95 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
        formFieldInputShowPasswordButton: "text-on-surface-variant hover:text-on-surface",
        formFieldHintText: "text-on-surface-variant",
        formFieldErrorText: "text-red-600 dark:text-red-300",
        formFieldSuccessText: "text-primary",
        formFieldWarningText: "text-amber-700 dark:text-amber-300",
        formResendCodeLink: "text-primary",
        otpCodeFieldInput: "rounded-2xl border border-outline/50 bg-surface-container/95 !text-on-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] dark:border-outline-variant/70 dark:bg-surface-container-high/95 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
        dividerLine: "bg-outline-variant",
        dividerText: "text-on-surface-variant",
        footer: "bg-gradient-to-t from-primary/6 to-transparent",
        footerAction: "text-on-surface-variant/90",
        footerActionLink: "text-primary hover:text-primary",
        identityPreviewText: "text-on-surface",
        identityPreviewEditButton: "text-primary",
        alternativeMethodsBlockButton: "rounded-2xl border border-outline-variant/45 bg-surface-container-low/88 text-on-surface hover:bg-surface-container",
        alternativeMethodsBlockButtonText: "text-on-surface",
        badge: "rounded-full border border-outline-variant/45 bg-surface-container text-on-surface-variant",
        navbarMobileMenuButton: "text-on-surface-variant hover:text-on-surface hover:bg-surface-container",
        navbar: "bg-surface-container-lowest border-r border-outline-variant/30",
        navbarButton: "text-on-surface-variant hover:bg-surface-container hover:text-on-surface",
        navbarButtonActive: "bg-primary/10 text-primary",
        page: "bg-surface-container-lowest",
        pageScrollBox: "bg-transparent",
        profilePage: "bg-surface-container-lowest",
        profileSection: "border border-outline-variant/35 bg-surface-container-lowest",
        profileSectionTitle: "text-on-surface font-headline",
        profileSectionContent: "text-on-surface",
        profileSectionPrimaryButton: "bg-primary text-on-primary hover:brightness-110",
        profileSectionSecondaryButton: "border border-outline-variant/40 bg-surface-container-low text-on-surface hover:bg-surface-container",
        userButtonPopoverActionButton: "rounded-xl text-on-surface-variant hover:bg-surface-container hover:text-on-surface",
        userButtonPopoverActionButtonText: "text-inherit font-medium",
        userButtonPopoverActionButtonIcon: "text-on-surface-variant",
        userButtonPopoverFooter: "border-t border-outline-variant/25 bg-gradient-to-t from-primary/6 to-transparent",
        userButtonPopoverFooterAction: "text-on-surface-variant/90",
        userButtonPopoverFooterActionLink: "text-primary hover:text-primary",
        modalCloseButton: "rounded-full bg-surface-container-low/90 text-on-surface-variant shadow-none hover:bg-surface-container hover:text-on-surface",
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

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cleanupThemePreference();
  });
}
