import { Card } from "@/components/ui/card"

export function RoadmapSection() {
  const roadmapPhases = [
    {
      version: "1.0",
      title: "Style Controls",
      features: [
        "Style browser with search",
        "Tempo & transpose control",
        "Section switching (Intro, Main, Fill, Ending)",
      ],
    },
    {
      version: "1.1",
      title: "Smart Composer",
      features: [
        "AI-assisted chord progression",
        "Style-aware arrangement suggestions",
        "Real-time harmony generation",
      ],
    },
    {
      version: "1.2",
      title: "Registration Memory",
      features: ["Save/recall complete setups", "Organize by song or setlist", "Quick-switch between configurations"],
    },
    {
      version: "1.3",
      title: "Multi-Pad Control",
      features: ["Trigger and manage multi-pads", "Custom pad assignment", "Sync with style playback"],
    },
    {
      version: "1.4",
      title: "Advanced Features",
      features: ["MIDI recording & playback", "Custom voice editing", "Performance analytics"],
    },
  ]

  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4 sm:mb-6">
            The Roadmap Ahead.
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-foreground/90 leading-relaxed max-w-3xl mx-auto">
            SmartBridge will expand through planned releases, each adding new modules and capabilities.
            <br className="hidden sm:block" />
            The roadmap reflects both technical goals and community input.
          </p>
        </div>

        <div className="space-y-6">
          {roadmapPhases.map((phase, index) => (
            <Card key={index} className="p-6 sm:p-8 bg-card border-border hover:border-primary/50 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
                <div className="flex-shrink-0">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 border border-primary/20">
                    <span className="text-lg font-bold text-primary">{phase.version}</span>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl sm:text-2xl font-semibold text-foreground mb-3">{phase.title}</h3>
                  <ul className="space-y-2">
                    {phase.features.map((feature, featureIndex) => (
                      <li
                        key={featureIndex}
                        className="flex items-start gap-2 text-sm sm:text-base text-muted-foreground"
                      >
                        <span className="text-primary mt-1">•</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm sm:text-base text-muted-foreground italic max-w-3xl mx-auto">
            Release timing depends on testing, feedback, and real-world use. Each phase builds on the previous one,
            ensuring stability and usability at every step.
          </p>
        </div>
      </div>
    </section>
  )
}
