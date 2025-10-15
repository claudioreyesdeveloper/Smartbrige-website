import { Sparkles, Wand2, FileMusic, Layers } from "lucide-react"

export function ComingFeatures() {
  const upcoming = [
    {
      icon: Wand2,
      title: "Smart Composer",
      description: "AI-assisted composition that understands Yamaha's voice architecture",
    },
    {
      icon: FileMusic,
      title: "Registration Manager",
      description: "Organize and recall your setups with visual clarity",
    },
    {
      icon: Layers,
      title: "Multi-Part Editor",
      description: "Layer and split voices with precision control",
    },
  ]

  return (
    <section className="py-16 sm:py-20 md:py-24 px-4 sm:px-6 bg-muted/30">
      <div className="container mx-auto max-w-6xl">
        <div className="flex items-center gap-2 sm:gap-3 mb-6 sm:mb-8">
          <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-primary" strokeWidth={1.5} />
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Coming Features</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {upcoming.map((feature) => (
            <div key={feature.title} className="p-5 sm:p-6 border border-border rounded-lg bg-card/50">
              <feature.icon className="w-7 h-7 sm:w-8 sm:h-8 text-primary/70 mb-2 sm:mb-3" strokeWidth={1.5} />
              <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
