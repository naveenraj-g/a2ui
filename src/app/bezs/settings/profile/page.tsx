import { redirect } from "next/navigation";
import { getServerSession } from "@/modules/server/auth/get-session";
import ProfileSettings from "@/modules/client/bezs/components/settings/ProfileSettings";

export default async function ProfileSettingsPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
    return null;
  }

  return <ProfileSettings user={session.user} />;
}
