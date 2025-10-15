import { Button } from "@/components/ui/button"
import { Play } from "lucide-react"

export function HeroSection() {
  return (
    <section className="gradient-hero text-white py-24 md:py-32">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="inline-block px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm font-medium mb-4">
            Compatible with Yamaha PSR, Genos, and Tyros
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-balance">SmartBridge – Your Yamaha, Unlocked.</h1>
          <p className="text-xl md:text-2xl text-white/90">Browse, mix, and perform without menus or limits.</p>
          <p className="text-lg text-white/80 max-w-3xl mx-auto leading-relaxed">
            SmartBridge is a unified control interface for Yamaha keyboards. It combines a 32-channel mixer, voice
            browser, style engine, and visual composer into one intuitive workspace. Built for live performers,
            producers, and arrangers, SmartBridge eliminates menu-diving and puts expressive control at your fingertips.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
            <Button size="lg" className="bg-white text-purple-600 hover:bg-white/90 text-lg px-8 py-6">
              Try Live Demo
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-2 border-white text-white hover:bg-white/10 text-lg px-8 py-6 bg-transparent"
            >
              <Play className="w-5 h-5 mr-2" />
              Watch Overview
            </Button>
          </div>
          <p className="text-sm text-white/70 pt-4">Developed by a Yamaha keyboardist for Yamaha players.</p>
        </div>
      </div>
    </section>
  )
}
