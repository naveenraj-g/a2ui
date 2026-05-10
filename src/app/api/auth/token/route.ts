import { NextResponse } from "next/server";
import { getServerSession } from "@/modules/server/auth/get-session";

export async function POST(request: Request) {
  const { code, code_verifier, redirect_uri } = await request.json();
  const session = await getServerSession();

  const clientId = process.env.NEXT_PUBLIC_BETTER_AUTH_CLIENT_ID;
  const clientSecret = process.env.BETTER_AUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Missing OAuth credentials" },
      { status: 500 },
    );
  }

  if (!code || !code_verifier || !redirect_uri) {
    return NextResponse.json(
      { error: "Missing required parameters" },
      { status: 400 },
    );
  }

  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code,
    code_verifier,
    redirect_uri,
  });

  const tokenRes = await fetch(
    `${process.env.NEXT_PUBLIC_BETTER_AUTH_URL}/api/auth/oauth2/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: params.toString(),
    },
  );

  const tokenData = await tokenRes.json();

  if (!tokenRes.ok) {
    return NextResponse.json(
      {
        error:
          tokenData.error_description ??
          tokenData.error ??
          "Token exchange failed",
      },
      { status: tokenRes.status },
    );
  }

  return NextResponse.json({
    ...tokenData,
    redirectUrl: session?.session.activeRoleRedirectUrl,
  });
}
