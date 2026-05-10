import { redirect } from "next/navigation";
import { getServerSession } from "@/modules/server/auth/get-session";
import SecuritySettings from "@/modules/client/bezs/components/settings/SecuritySettings";

export default async function SecuritySettingsPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
    return null;
  }

  return <SecuritySettings user={session.user} />;
}
