import type { Metadata } from "next";
import { Funnel_Display, Funnel_Sans } from "next/font/google";
import "../globals.css";
import '../lib/simplescrollbars.css';
import { PolicyPanel, PolicyPanelProvider } from "@/components/policy-panel"
import AppHeader from "@/components/header/app-header"
import { PoliciesProvider } from "@/components/files-list"
import { SettingsProvider } from "@/lib/settings-context"
import SonnerProvider from "@/components/sonner-provider"
import { TooltipProvider } from "@/components/ui/tooltip"

const funnelDisplay = Funnel_Display({
  variable: "--font-funnel-display",
  subsets: ["latin"],
  display: "swap",
});

const funnelSans = Funnel_Sans({
  variable: "--font-funnel-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "RegoLab",
  description: "Policy as Code Sandbox",
    icons: {
    icon: "/mayn-favicon.svg",
    shortcut: "/mayn-favicon.svg",
    apple: "/mayn-favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${funnelDisplay.variable} ${funnelSans.variable} antialiased`}
      >
        <div className="[--header-height] md:[--header-height] min-h-screen h-full">
          <SettingsProvider>
            <TooltipProvider delayDuration={0}>
              <PolicyPanelProvider>
                <PoliciesProvider>
                  <SonnerProvider />
                  <div className="flex flex-col h-full">
                    <AppHeader />

                    <div className="flex flex-1 overflow-hidden pt-(--header-total-height)">
                      <div className="flex gap-2 p-2 w-full h-full">
                        <PolicyPanel />

                        <main className="flex-1 min-w-0 overflow-hidden">
                          {children}
                        </main>
                      </div>
                    </div>
                  </div>
                </PoliciesProvider>
              </PolicyPanelProvider>
            </TooltipProvider>
          </SettingsProvider>
        </div>
      </body>
    </html>
  );
}
