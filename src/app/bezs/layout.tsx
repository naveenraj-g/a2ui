import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getServerSession } from "@/modules/server/auth/get-session";
import BreadCrumb from "@/modules/shared/components/BreadCrumb";
import AppNavbar from "@/modules/shared/components/navbar/AppNavbar";
import { redirect } from "next/navigation";
import { MenuBar } from "@/modules/shared/components/menubar/MenuBar";

export const dynamic = "force-dynamic";

export default async function BezsSidebarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  const user = {
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
    username: session.user.username,
  };

  return (
    <SidebarProvider>
      <MenuBar {...user} />
      <SidebarInset className="min-w-0">
        <AppNavbar user={user} />
        <main className="mx-auto px-4 py-4 pb-6 max-w-[110rem] space-y-6 w-full">
          <BreadCrumb />
          <div className="w-full">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
