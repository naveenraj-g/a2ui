"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";

function CallbackContent() {
  const params = useSearchParams();
  const code = params?.get("code");
  const state = params?.get("state");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) {
      setError("No authorization code provided");
      return;
    }

    const savedState = localStorage.getItem("oauth_state");
    if (state !== savedState) {
      setError("Invalid state parameter");
      return;
    }

    const codeVerifier = localStorage.getItem("oauth_code_verifier");
    if (!codeVerifier) {
      setError("No PKCE code verifier found");
      return;
    }

    exchangeCode(code, codeVerifier);
  }, [code, state]);

  async function exchangeCode(code: string, codeVerifier: string) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    const res = await fetch("/api/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        code_verifier: codeVerifier,
        redirect_uri: `${appUrl}/callback`,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Failed to exchange token");
      return;
    }

    localStorage.removeItem("oauth_state");
    localStorage.removeItem("oauth_code_verifier");

    window.location.href = data.redirectUrl ?? "/";
  }

  if (error) {
    return (
      <div className="p-6 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg max-w-lg mx-auto mt-12 text-center">
        <h2 className="text-xl font-bold mb-2">Authentication Error</h2>
        <p>{error}</p>
        <button
          onClick={() => (window.location.href = "/")}
          className="mt-4 px-4 py-2 bg-destructive/10 hover:bg-destructive/20 rounded-md transition-colors"
        >
          Return Home
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
      <div className="w-12 h-12 border-4 border-border border-t-primary rounded-full animate-spin" />
      <p className="text-lg font-medium text-foreground">Completing authentication...</p>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={<div className="text-center mt-12 text-muted-foreground">Loading...</div>}>
      <CallbackContent />
    </Suspense>
  );
}
