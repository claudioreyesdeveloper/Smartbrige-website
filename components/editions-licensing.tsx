import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"

export function EditionsLicensing() {
  const editions = [
    {
      name: "Standalone (Desktop)",
      price: "$70",
      description: "Full desktop application for Windows and macOS",
      features: ["All current modules", "Lifetime updates", "Priority support"],
    },
    {
      name: "VST/AU Plugin",
      price: "$100",
      description: "Integrate with your DAW workflow",
      features: ["DAW integration", "Automation support", "Lifetime updates"],
    },
    {
      name: "iPad Edition",
      price: "$110",
      description: "Touch-optimized interface for iPad",
      features: ["Touch interface", "Portable control", "Lifetime updates"],
    },
  ]

  return (
    <section id="editions" className="py-24 px-6 bg-muted/30">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-foreground mb-4">Editions & Licensing</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Choose the edition that fits your workflow. One-time purchase, lifetime updates.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {editions.map((edition) => (
            <Card
              key={edition.name}
              className="p-6 bg-card border-border hover:border-primary/50 transition-all duration-300"
            >
              <h3 className="text-xl font-semibold text-foreground mb-2">{edition.name}</h3>
              <p className="text-3xl font-bold text-primary mb-2">{edition.price}</p>
              <p className="text-sm text-muted-foreground mb-6">{edition.description}</p>
              <ul className="space-y-2 mb-6">
                {edition.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm text-foreground">
                    <Check className="w-4 h-4 text-primary" strokeWidth={2} />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button className="w-full" variant="default">
                Get Started
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
