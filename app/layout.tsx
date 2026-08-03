import { ClerkProvider } from "@clerk/nextjs"
import type { Metadata } from "next"
import { DM_Sans, Instrument_Serif, Geist } from "next/font/google"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { isClerkPublishableEnabled } from "@/lib/billing/clerk-config"
import { SITE } from "@/lib/site"
import { cn } from "@/lib/utils"
import "./globals.css"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
})

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument-serif",
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: "SmartBridge — Desktop and Style Maker for Yamaha musicians",
    template: "%s · SmartBridge",
  },
  description:
    "Connect your Yamaha keyboard to song building, performance libraries, vocals, solos, harmony, Cubase, Synthesizer V, and native style creation.",
  openGraph: {
    title: "SmartBridge — Your whole musical workflow from one screen",
    description:
      "SmartBridge Desktop and Style Maker connect Yamaha keyboards, song building, musical parts, and production.",
    url: SITE.url,
    siteName: "SmartBridge",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: `${SITE.url}/og-desktop.png`,
        width: 1200,
        height: 630,
        alt: "SmartBridge — Your whole musical workflow from one screen",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SmartBridge — Your whole musical workflow from one screen",
    description: "Desktop and browser tools for Yamaha musicians.",
    images: [`${SITE.url}/og-desktop.png`],
  },
}

const clerkConfigured = isClerkPublishableEnabled()

function Providers({ children }: { children: React.ReactNode }) {
  const body = (
    <TooltipProvider>
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
      <Toaster />
    </TooltipProvider>
  )

  if (!clerkConfigured) return body
  return <ClerkProvider>{body}</ClerkProvider>
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={cn(
        dmSans.variable,
        instrumentSerif.variable,
        "font-sans",
        geist.variable,
      )}
    >
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
