import { getServerSession } from "@/modules/server/auth/get-session";
import RootNavbar from "@/modules/client/components/RootNavbar";

export default async function Home() {
  const session = await getServerSession();

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <RootNavbar session={session} />

      <div>
        <h1>Landing Page</h1>
      </div>
    </div>
  );
}
