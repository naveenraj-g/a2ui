import { getServerSession } from "@/modules/server/auth/get-session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function BezsPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <div>
      <h1>Bezs</h1>
    </div>
  );
}
