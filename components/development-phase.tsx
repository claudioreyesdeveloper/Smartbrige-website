import { Card } from "@/components/ui/card"
import { Gauge, Library, Sliders } from "lucide-react"

export function DevelopmentPhase() {
  const features = [
    {
      icon: Gauge,
      title: "Performance Dashboard",
      description:
        "Real-time control of four parts (Left 1, Left 2, Right 1, Right 2), style selection, and transport control.",
    },
    {
      icon: Library,
      title: "Voice Browser",
      description: "Explore and assign voices instantly across 16 categories.",
    },
    {
      icon: Sliders,
      title: "Mixer Interface",
      description: "Professional 32-channel mixing with volume, pan, reverb, chorus, and brightness control.",
    },
  ]

  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6 bg-muted/30">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4 sm:mb-6">
            Currently in Development.
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-foreground/90 leading-relaxed max-w-3xl mx-auto mb-6">
            SmartBridge is in its initial development phase.
            <br className="hidden sm:block" />
            The first milestone, version 0.9, will deliver three functional modules forming the foundation of the
            system:
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mb-12">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <Card key={index} className="p-6 sm:p-8 bg-card border-border hover:border-primary/50 transition-colors">
                <Icon className="w-10 h-10 sm:w-12 sm:h-12 text-primary mb-4" strokeWidth={1.5} />
                <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-3">{feature.title}</h3>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">{feature.description}</p>
              </Card>
            )
          })}
        </div>

        <div className="text-center">
          <p className="text-sm sm:text-base text-muted-foreground italic max-w-3xl mx-auto">
            These three modules form the 0.9 release — now in active testing through the online mockup. Users can
            explore the interface and share feedback directly.
          </p>
        </div>
      </div>
    </section>
  )
}
