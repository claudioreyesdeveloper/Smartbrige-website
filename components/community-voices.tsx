import { Card } from "@/components/ui/card"
import { Quote } from "lucide-react"

const testimonials = [
  {
    quote: "Finally, a way to control the Genos without losing the flow of performance.",
    author: "Early Tester",
  },
  {
    quote: "Makes live setup changes effortless.",
    author: "Yamaha Community Member",
  },
  {
    quote: "The first software that truly feels like part of the keyboard.",
    author: "Professional Keyboardist",
  },
]

export function CommunityVoices() {
  return (
    <section className="py-24 px-6 bg-muted/30">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-foreground mb-4">What Musicians Are Saying</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="bg-card border-border hover:border-primary/50 transition-all duration-300 p-6">
              <Quote className="h-8 w-8 text-primary/40 mb-4" strokeWidth={1.5} />
              <p className="text-lg mb-4 leading-relaxed text-foreground">{testimonial.quote}</p>
              <p className="text-sm text-muted-foreground">— {testimonial.author}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
