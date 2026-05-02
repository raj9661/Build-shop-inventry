"use client";
import React from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { ShopProvider } from "../contexts/ShopContext";
import { CompactModeProvider } from "./compact-mode-provider";
import { MobileNav } from "@/components/mobile-nav";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";

// Load the sidebar client-only (ssr: false) — it depends on localStorage for
// userRole, currentShop, shops, and isCollapsed which differ server vs client.
// This eliminates all hydration mismatches permanently.
const CollapsibleSidebar = dynamic(
  () => import("./collapsible-sidebar").then((m) => ({ default: m.CollapsibleSidebar })),
  {
    ssr: false,
    // Placeholder has the same minimum width as the collapsed sidebar so layout doesn't jump
    loading: () => <div className="hidden md:flex w-16 border-r bg-muted/40 flex-shrink-0" />,
  }
);

function LayoutWithSidebar({ children }: { children: React.ReactNode }) {
  return (
    <ShopProvider>
      <CompactModeProvider>
        {/* Desktop Layout */}
        <div className="hidden md:flex min-h-screen w-full">
          <CollapsibleSidebar />
          <div className="flex flex-col flex-1">
            <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">{children}</main>
          </div>
        </div>
        {/* Mobile Layout */}
        <div className="md:hidden min-h-screen w-full flex flex-col">
          <MobileNav />
          <main className="flex flex-1 flex-col p-4">{children}</main>
        </div>
        <SonnerToaster />
        <Toaster />
      </CompactModeProvider>
    </ShopProvider>
  );
}

export default function LayoutClientWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/register") || pathname.startsWith("/forgot");
  const isLandingPage = pathname === "/landing";
  const isSignupPage = pathname === "/signup";
  const isVerifyEmailPage = pathname === "/verify-email";
  const isOnboardingPage = pathname === "/onboarding";

  if (isAuthPage || isLandingPage || isSignupPage || isVerifyEmailPage || isOnboardingPage) {
    // No sidebar, no ShopProvider for auth pages, landing page, signup page, verify email page, and onboarding page
    return <>{children}</>;
  }
  return <LayoutWithSidebar>{children}</LayoutWithSidebar>;
} 