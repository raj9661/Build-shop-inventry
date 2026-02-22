"use client";
import React from "react";
import { usePathname } from "next/navigation";
import { ShopProvider } from "../contexts/ShopContext";
import { CollapsibleSidebar } from "./collapsible-sidebar";
import { CompactModeProvider } from "./compact-mode-provider";
import { MobileNav } from "./mobile-nav";
import { Toaster } from "@/components/ui/sonner";

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