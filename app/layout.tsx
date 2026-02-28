import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { cn } from "@/lib/utils"
import { LanguageProvider } from "@/hooks/use-language"
import { ShopProvider } from "./contexts/ShopContext"
import { CollapsibleSidebar } from "@/app/components/collapsible-sidebar"
import { CompactModeProvider } from "@/app/components/compact-mode-provider"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from "@/components/theme-provider"
import AuthProvider from "@/components/auth-provider"
import LayoutClientWrapper from './components/LayoutClientWrapper';
import HydrationFix from "@/app/components/hydration-fix"

// Import scheduled notifications service (server-side only)
if (typeof window === 'undefined') {
  import('./lib/scheduled-notifications');
}

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Inventry Management",
  description: "A modern inventory management system.",
  generator: 'v0.dev'
}

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
        <div className="md:hidden min-h-screen w-full">
          <main className="flex flex-1 flex-col">{children}</main>
        </div>
        <Toaster />
      </CompactModeProvider>
    </ShopProvider>
  )
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // This hook only works on client, so we use a workaround:
  // We check for the pathname in a client component wrapper below.
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body
        className={cn("min-h-screen bg-background font-sans antialiased", inter.className)}
        suppressHydrationWarning={true}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AuthProvider>
            <LanguageProvider>
              <HydrationFix />
              <LayoutClientWrapper>{children}</LayoutClientWrapper>
            </LanguageProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
