import { Card } from "@/components/ui/card"
import { Download, Plug, Tablet, Package } from "lucide-react"

export function EditionsSection() {
  const editions = [
    {
      icon: Download,
      name: "Standalone (Desktop)",
      description: "Download and play instantly.",
      includes: "Includes installer, starter setups, and quick-start guide.",
    },
    {
      icon: Plug,
      name: "VST Plugin",
      description: "Deep DAW integration for producers and composers.",
      includes: "Includes VST3 plugin, templates, and integration guide.",
    },
    {
      icon: Tablet,
      name: "iPad (iOS)",
      description: "Touch-first control for rehearsals and live use.",
      includes: "Includes iOS app, touch-optimized layouts, and setup guide.",
    },
    {
      icon: Package,
      name: "All Platforms Bundle",
      description: "One license for Desktop, VST, and iPadOS.",
      includes: "Includes all editions with unified license management.",
    },
  ]

  return (
    <section className="py-20 px-4 bg-white">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-black">Choose Your Edition</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {editions.map((edition) => {
            const Icon = edition.icon
            return (
              <Card
                key={edition.name}
                className="bg-white border border-border/50 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-8 hover:border-primary/60"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-2 text-black">{edition.name}</h3>
                    <p className="text-black mb-3 leading-relaxed">{edition.description}</p>
                    <p className="text-sm text-black leading-relaxed">{edition.includes}</p>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}
