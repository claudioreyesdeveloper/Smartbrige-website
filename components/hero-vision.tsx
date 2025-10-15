import { Button } from "@/components/ui/button"
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
          SmartBridge began as a personal project to make Yamaha arrangers faster and more intuitive to use. It brings
          every core function — voice selection, mixing, and style control — into one modern, touch-ready interface. No
          menus, no guesswork, just music.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center px-4 mb-8">
          <Button size="lg" className="gap-2">
            <Play className="w-4 h-4" />
            Try the Demo
          </Button>
          <Button size="lg" variant="outline" className="gap-2 bg-transparent">
            See the Interface
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="inline-block px-4 py-2 bg-primary/10 border border-primary/20 rounded-full">
          <p className="text-sm text-foreground font-medium">Compatible with PSR, Genos & Tyros5</p>
        </div>
      </div>
    </section>
  )
}
