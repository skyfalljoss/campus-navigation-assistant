import type { PropsWithChildren } from "react";

interface E2EClerkUser {
  fullName?: string | null;
  username?: string | null;
  imageUrl?: string;
  primaryEmailAddress?: {
    emailAddress: string;
  } | null;
}

interface E2EClerkSession {
  isSignedIn?: boolean;
  token?: string | null;
  user?: E2EClerkUser | null;
}

declare global {
  interface Window {
    __E2E_CLERK__?: E2EClerkSession;
  }
}

function readSession(): Required<E2EClerkSession> {
  if (typeof window === "undefined") {
    return {
      isSignedIn: false,
      token: null,
      user: null,
    };
  }

  return {
    isSignedIn: Boolean(window.__E2E_CLERK__?.isSignedIn),
    token: window.__E2E_CLERK__?.token ?? null,
    user: window.__E2E_CLERK__?.user ?? null,
  };
}

async function getToken() {
  return readSession().token;
}

const clerkApi = {
  openSignIn: () => undefined,
  openUserProfile: () => undefined,
};

export function ClerkProvider({ children }: PropsWithChildren) {
  return <>{children}</>;
}

export function SignedIn({ children }: PropsWithChildren) {
  return readSession().isSignedIn ? <>{children}</> : null;
}

export function SignedOut({ children }: PropsWithChildren) {
  return readSession().isSignedIn ? null : <>{children}</>;
}

export function SignInButton({ children }: PropsWithChildren<{ mode?: string }>) {
  return <>{children}</>;
}

export function SignOutButton({ children }: PropsWithChildren) {
  return <>{children}</>;
}

export function UserButton() {
  return null;
}

export function useAuth() {
  const session = readSession();

  return {
    getToken,
    isLoaded: true,
    isSignedIn: session.isSignedIn,
  };
}

export function useClerk() {
  return clerkApi;
}

export function useUser() {
  const session = readSession();

  return {
    isLoaded: true,
    user: session.user,
  };
}
