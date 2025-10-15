import { Card } from "@/components/ui/card"
import { Monitor, Smartphone, Gauge, RefreshCw } from "lucide-react"

const uiFeatures = [
  {
    icon: Monitor,
    title: "Dark Mode for Stage Use",
    description: "Optimized dark interface reduces eye strain during performances and low-light environments.",
  },
  {
    icon: Smartphone,
    title: "Responsive Design",
    description: "Works seamlessly on tablets, touchscreens, and desktop displays for maximum flexibility.",
  },
  {
    icon: Gauge,
    title: "Real-time Feedback",
    description: "Visual meters, sliders, and indicators provide instant feedback on all parameters.",
  },
  {
    icon: RefreshCw,
    title: "Persistent State",
    description: "Your settings and configurations sync across tabs and sessions automatically.",
  },
]

export function UIShowcase() {
  return (
    <section id="showcase" className="py-20 px-4 bg-muted/20">
      <div className="container mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Modern UI/UX Design</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-pretty">
            Built for performers with a focus on usability, aesthetics, and real-time control
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {uiFeatures.map((feature) => (
            <Card key={feature.title} className="p-6 bg-card border border-border">
              <feature.icon className="h-8 w-8 text-primary mb-3" />
              <h3 className="text-lg font-semibold mb-2 text-card-foreground">{feature.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
            </Card>
          ))}
        </div>

        <div className="relative rounded-xl overflow-hidden border border-border bg-card">
          <img
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-dAHmuKyj9Y8u5D4NfkCN4JoPw4070S.png"
            alt="SmartBridge Interface Preview showing Home screen with voice selection cards"
            className="w-full h-auto"
          />
        </div>
      </div>
    </section>
  )
}
