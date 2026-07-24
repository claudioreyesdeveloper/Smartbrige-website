import { ClerkProvider } from "@clerk/nextjs"
import type { Metadata } from "next"
import { DM_Sans, Instrument_Serif, Geist } from "next/font/google"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
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
    default: "SmartBridge — Songwriting workflow for Yamaha keyboards",
    template: "%s · SmartBridge",
  },
  description:
    "From MIDI phrase to full arrangement. SmartBridge connects your Yamaha keyboard to chord-aware phrases, vocals, lyrics, and DAW production.",
  openGraph: {
    title: "SmartBridge — From phrase to full arrangement",
    description:
      "Arrangement workflow for Yamaha Tyros, Genos, PSR-SX, and Motif — phrases, vocals, lyrics, and Cubase integration.",
    url: SITE.url,
    siteName: "SmartBridge",
    locale: "en_US",
    type: "website",
  },
}

const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)

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
