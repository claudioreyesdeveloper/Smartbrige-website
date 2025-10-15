import { Card } from "@/components/ui/card"
import { CheckCircle2, Circle } from "lucide-react"

const milestones = [
  { title: "Full MIDI Integration", status: "planned" },
  { title: "Complete DAW Support", status: "planned" },
  { title: "Advanced Voice Management Tools", status: "planned" },
  { title: "Expanded Yamaha Model Support", status: "planned" },
]

export function Roadmap() {
  return (
    <section className="py-20 px-4 bg-background">
      <div className="container mx-auto max-w-5xl">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">The Road Ahead</h2>
          <p className="text-lg text-black max-w-3xl mx-auto leading-relaxed">
            SmartBridge is under continuous development. Upcoming releases include full MIDI and DAW integration,
            additional voice management tools, and broader support for new Yamaha models.
          </p>
        </div>

        <Card className="bg-white border border-border/50 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-8">
          <div className="space-y-4">
            {milestones.map((milestone, index) => (
              <div key={index} className="flex items-center gap-4">
                {milestone.status === "completed" ? (
                  <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0" />
                ) : (
                  <Circle className="h-6 w-6 text-black/40 flex-shrink-0" />
                )}
                <div>
                  <p className="text-lg font-medium text-foreground">{milestone.title}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  )
}
