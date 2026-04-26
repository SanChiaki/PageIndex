"use client";

import React, { useState, type ReactNode } from "react";
import { SidebarNav, type SidebarConversation } from "@/components/sidebar-nav";

export function AppShell({
  conversations,
  children,
}: {
  conversations: SidebarConversation[];
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen">
      <SidebarNav
        collapsed={collapsed}
        conversations={conversations}
        onToggleCollapse={() => setCollapsed((value) => !value)}
      />
      <main
        className={`relative min-h-screen px-4 pb-8 pt-4 transition-[margin] md:px-8 md:pb-10 md:pt-4 ${
          collapsed ? "md:ml-[6.75rem]" : "md:ml-[18.5rem]"
        }`}
      >
        <div className="mx-auto w-full max-w-[1280px]">{children}</div>
      </main>
    </div>
  );
}
