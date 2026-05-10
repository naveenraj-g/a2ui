"use client";

import { getServerSession } from "@/modules/server/auth/get-session";
import RootNavbar from "@/modules/client/components/RootNavbar";
import { Button } from "@/components/ui/button";

export default function Home() {
  // const session = await getServerSession();

  async function handleTestMcp() {
    const res = await fetch("/api/mcp-test");
    if (!res.ok) {
      console.log("error calling mcp");
    }

    const data = await res.json();
    console.log(data);
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* <RootNavbar session={session} /> */}

      <div>
        <Button onClick={handleTestMcp}>Test MCP</Button>
      </div>
    </div>
  );
}
