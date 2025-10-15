import { Music, Headphones, Film } from "lucide-react"

export function AudienceSegments() {
  const segments = [
    {
      icon: Music,
      title: "Live Keyboardists",
      description: "Play freely. Map everything fast. Reliable control built for the stage.",
    },
    {
      icon: Headphones,
      title: "Studio Producers",
      description: "Streamline your workflow. Deep MIDI access without setup fatigue.",
    },
    {
      icon: Film,
      title: "Film & Game Composers",
      description: "Handle complex routing and macros with elegance — orchestrate, don't troubleshoot.",
    },
  ]

  return (
    <section className="py-20 px-4 bg-background">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Built for Every Kind of Player.</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {segments.map((segment) => (
            <div
              key={segment.title}
              className="bg-white border border-border/50 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-8 hover:border-primary/60"
            >
              <div className="mb-6 flex justify-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <segment.icon className="h-8 w-8 text-primary" />
                </div>
              </div>
              <h3 className="text-2xl font-bold mb-4 text-center">{segment.title}</h3>
              <p className="text-muted-foreground leading-relaxed text-center">{segment.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
