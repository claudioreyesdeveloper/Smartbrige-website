import { Download, Puzzle, Tablet, Package } from "lucide-react"

const editions = [
  {
    icon: Download,
    title: "Standalone (Desktop)",
    description: "Download and play instantly. Includes installer, starter setups, and quick-start guide.",
    features: ["Windows & macOS", "Instant setup", "Offline mode"],
  },
  {
    icon: Puzzle,
    title: "VST Plugin",
    description: "Deep DAW integration for producers and composers. Full MIDI routing and automation support.",
    features: ["DAW integration", "MIDI automation", "Project sync"],
  },
  {
    icon: Tablet,
    title: "iPad (iOS)",
    description: "Touch-first control for rehearsals and live use. Optimized for iPad Pro and Air.",
    features: ["Touch optimized", "Portable", "Live ready"],
  },
  {
    icon: Package,
    title: "All Platforms Bundle",
    description: "One license for Desktop, VST, and iPadOS. Best value for multi-platform users.",
    features: ["All platforms", "Best value", "Lifetime updates"],
    featured: true,
  },
]

export function EditionsCards() {
  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Choose Your Edition</h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {editions.map((edition) => {
            const Icon = edition.icon
            return (
              <div
                key={edition.title}
                className={`bg-white border border-border/50 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-6 ${
                  edition.featured ? "ring-2 ring-primary" : ""
                }`}
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">{edition.title}</h3>
                <p className="text-foreground mb-4 text-sm leading-relaxed">{edition.description}</p>
                <ul className="space-y-2 mb-6">
                  {edition.features.map((feature) => (
                    <li key={feature} className="text-sm text-foreground flex items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mr-2" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
