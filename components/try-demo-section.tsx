import { Button } from "@/components/ui/button"
import { ExternalLink } from "lucide-react"

export function TryDemoSection() {
  return (
    <section id="demo" className="py-20 px-4 bg-muted/30">
      <div className="container mx-auto max-w-4xl text-center">
        <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">Test the SmartBridge Interface</h2>
        <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
          Explore the live GUI mockup directly in your browser — no installation or hardware required.
        </p>

        <Button
          size="lg"
          className="text-base px-8 bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-300 mb-8"
          asChild
        >
          <a href="https://v0-tyros-integrator.vercel.app" target="_blank" rel="noopener noreferrer">
            Open the Demo
            <ExternalLink className="ml-2 h-5 w-5" />
          </a>
        </Button>

        <p className="text-sm text-muted-foreground">
          You can leave comments inside the demo or email feedback to{" "}
          <a href="mailto:claudio.private@gmail.com" className="text-primary hover:underline">
            claudio.private@gmail.com
          </a>
        </p>
      </div>
    </section>
  )
}
