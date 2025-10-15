import { Button } from "@/components/ui/button"
import { ExternalLink } from "lucide-react"

export function TryItSection() {
  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6">
      <div className="container mx-auto max-w-4xl text-center">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-6">Explore the Interface.</h2>

        <p className="text-base sm:text-lg md:text-xl text-foreground/90 leading-relaxed max-w-3xl mx-auto mb-10">
          You can try the live GUI mockup directly in your browser. No installation or hardware required.
        </p>

        <Button size="lg" className="gap-2" asChild>
          <a href="https://v0-tyros-integrator.vercel.app" target="_blank" rel="noopener noreferrer">
            Open the Demo
            <ExternalLink className="w-4 h-4" />
          </a>
        </Button>

        <p className="text-sm text-muted-foreground mt-6 italic">
          Feedback can be submitted directly from the demo or via email.
        </p>
      </div>
    </section>
  )
}
