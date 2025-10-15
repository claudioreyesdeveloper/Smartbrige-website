"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { ArrowRight, Play } from "lucide-react"

export function HeroVision() {
  return (
    <section className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 pt-20 sm:pt-24">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-background to-background" />

      <div className="relative container mx-auto max-w-4xl text-center">
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-foreground mb-4 sm:mb-6 tracking-tight">
          SmartBridge – Your Yamaha, Unlocked.
        </h1>

        <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground mb-6 sm:mb-8 max-w-2xl mx-auto leading-relaxed px-4">
          A control environment built by a musician, for musicians.
        </p>

        <p className="text-base sm:text-lg text-foreground/90 mb-8 sm:mb-10 max-w-3xl mx-auto leading-relaxed px-4">
          SmartBridge is the control environment I wished for when playing my Genos. It fuses the precision of Yamaha's
          hardware with modern UI design, giving you full, fast control over performance, sound, and mixing through an
          elegant, touch-ready interface.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center px-4 mb-8">
          <Button
            size="lg"
            className="gap-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold shadow-lg shadow-amber-500/50"
            asChild
          >
            <a href="https://v0-tyros-integrator.vercel.app/" target="_blank" rel="noopener noreferrer">
              <Play className="w-4 h-4" />
              Try the Demo
            </a>
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button
                size="lg"
                variant="outline"
                className="gap-2 bg-transparent border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
              >
                See the Interface
                <ArrowRight className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl w-full p-0">
              <video
                controls
                className="w-full h-auto"
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/SmartBridge%20Introduction-c4BBK4Ms50ouOuKF8fxa6j4xcynpiR.mp4"
              >
                Your browser does not support the video tag.
              </video>
            </DialogContent>
          </Dialog>
        </div>

        <div className="inline-block px-4 py-2 bg-primary/10 border border-primary/20 rounded-full">
          <p className="text-sm text-foreground font-medium">Compatible with PSR, Genos & Tyros5</p>
        </div>
      </div>
    </section>
  )
}
