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
    default: "SmartBridge — Yamaha ideas to finished productions",
    template: "%s · SmartBridge",
  },
  description:
    "Keep one Yamaha song connected through performed MIDI, Cubase, Synthesizer V, lyrics, solos, harmony, and native style production—from the first chord to the final editable tracks.",
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
    title: "SmartBridge — Turn Yamaha ideas into finished productions",
    description:
      "The Yamaha, performed MIDI, Cubase, Synthesizer V, lyrics, solos, and harmony share one chord-aware song context.",
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
    title: "SmartBridge — Yamaha ideas to finished productions",
    description: "Keep the song connected from the Yamaha performance to the final editable production.",
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
