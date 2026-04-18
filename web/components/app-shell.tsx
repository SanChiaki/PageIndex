import type { ReactNode } from "react";
import { SidebarNav, type SidebarConversation } from "@/components/sidebar-nav";

export function AppShell({
  conversations,
  children,
}: {
  conversations: SidebarConversation[];
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <SidebarNav conversations={conversations} />
      <main className="relative min-h-screen px-4 pb-8 pt-6 md:ml-[18.5rem] md:px-8 md:pb-12 md:pt-8">
        <div className="mx-auto w-full max-w-[1180px]">{children}</div>
      </main>
    </div>
  );
}
