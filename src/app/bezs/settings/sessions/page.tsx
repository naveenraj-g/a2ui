import { redirect } from "next/navigation";
import { getServerSession } from "@/modules/server/auth/get-session";
import SessionsSettings from "@/modules/client/bezs/components/settings/SessionsSettings";

export default async function SessionsSettingsPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
    return null;
  }

  return <SessionsSettings currentToken={session.session.token} />;
}
