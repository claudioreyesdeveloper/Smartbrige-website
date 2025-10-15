import { Zap, Gauge, Layers, Users } from "lucide-react"

export function BenefitOverview() {
  const benefits = [
    {
      icon: Zap,
      title: "No menu maze",
      description: "Every channel and setting under your fingertips.",
    },
    {
      icon: Gauge,
      title: "Performance speed",
      description: "Map, recall, and play without stopping.",
    },
    {
      icon: Layers,
      title: "32-channel clarity",
      description: "Mixer, style, and voice control in one view.",
    },
    {
      icon: Users,
      title: "Built for musicians",
      description: "Not engineers.",
    },
  ]

  return (
    <section className="py-24 px-4 section-alt">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-black">Why SmartBridge</h2>
          <p className="text-lg text-black max-w-2xl mx-auto">Designed to eliminate friction and maximize creativity</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {benefits.map((benefit) => {
            const Icon = benefit.icon
            return (
              <div
                key={benefit.title}
                className="bg-white border border-border/50 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-8 text-center hover:border-primary/60"
              >
                <div className="inline-flex p-4 rounded-full bg-primary/10 border border-primary/30 mb-6">
                  <Icon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-black">{benefit.title}</h3>
                <p className="text-sm text-black leading-relaxed">{benefit.description}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
