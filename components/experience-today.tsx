import { Sliders, Library, Play } from "lucide-react"
import { Card } from "@/components/ui/card"

export function ExperienceToday() {
  const features = [
    {
      icon: Sliders,
      title: "Mixer",
      description:
        "16-channel control of volume, pan, reverb, chorus, and brightness. Every parameter at your fingertips.",
      status: "Available Now",
    },
    {
      icon: Library,
      title: "Voice Browser",
      description: "1,000+ voices across 16 categories. Find the perfect sound instantly, without menu diving.",
      status: "Available Now",
    },
    {
      icon: Play,
      title: "Style Controls",
      description: "Select, start/stop, variation, and tempo control. Your rhythm section, simplified.",
      status: "Coming Soon",
    },
  ]

  return (
    <section id="experience" className="py-16 sm:py-20 md:py-24 px-4 sm:px-6">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-3 sm:mb-4">Experience Today</h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-4">
            Core modules that redefine how you interact with your Yamaha keyboard.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="p-5 sm:p-6 bg-card border-border hover:border-primary/50 transition-all duration-300"
            >
              <feature.icon className="w-8 h-8 sm:w-10 sm:h-10 text-primary mb-3 sm:mb-4" strokeWidth={1.5} />
              <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm sm:text-base text-muted-foreground mb-3 sm:mb-4 leading-relaxed">
                {feature.description}
              </p>
              <span className="text-xs sm:text-sm text-primary font-medium">{feature.status}</span>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
