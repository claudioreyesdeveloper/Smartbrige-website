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
import "./site-header-tablet-fix.css"

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
    default: "SmartBridge — Help shape what comes next",
    template: "%s · SmartBridge",
  },
  description:
    "SmartBridge is being built in public. Watch the real Yamaha, MIDI, Cubase and vocal-production features, then help decide what should be simplified, improved or built next.",
  keywords: [
    "Yamaha arranger production software",
    "Genos Cubase integration",
    "Tyros Cubase workflow",
    "chord aware MIDI performances",
    "Yamaha style maker",
    "Synthesizer V lyrics",
    "MegaVoice MIDI",
  ],
  openGraph: {
    title: "SmartBridge — Help shape what comes next",
    description:
      "Watch real SmartBridge features, give direct product input, vote on suggestions, and see what moves from feedback into development.",
    url: SITE.url,
    siteName: "SmartBridge",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: `${SITE.url}/og-desktop.png`,
        width: 1200,
        height: 630,
        alt: "SmartBridge Yamaha-to-production workflow",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SmartBridge — Help shape what comes next",
    description: "Watch the current features and help direct what SmartBridge should simplify, improve or build next.",
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
