import { Monitor, Puzzle, Tablet } from "lucide-react"
import { Card } from "@/components/ui/card"

export function TechnicalVision() {
  const platforms = [
    { icon: Monitor, name: "Desktop App", status: "In Development" },
    { icon: Puzzle, name: "VST Plugin", status: "In Development" },
    { icon: Tablet, name: "iPadOS", status: "In Development" },
  ]

  return (
    <section className="py-20 px-4 bg-background">
      <div className="container mx-auto max-w-5xl">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Expanding the Bridge</h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            The smartbridge web version is the first step toward a connected ecosystem. A standalone desktop edition, a
            VST plugin, and an iPadOS version are all in development — sharing the same control architecture for a
            consistent experience across every platform.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mt-12">
          {platforms.map((platform) => (
            <Card key={platform.name} className="p-6 bg-card border border-border text-center">
              <platform.icon className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">{platform.name}</h3>
              <p className="text-sm text-primary">{platform.status}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
