import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BookOpen, HelpCircle, Mail } from "lucide-react"

export function SupportDocumentation() {
  return (
    <section className="py-20 px-4 bg-muted/30">
      <div className="container mx-auto max-w-5xl">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">Support & Resources</h2>
          <p className="text-lg text-muted-foreground">
            Direct developer support. Responses typically within 24–48 hours.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="bg-white border border-border/50 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 border border-primary/20 mb-4">
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-foreground">Documentation</h3>
            <p className="text-sm text-muted-foreground mb-4">Complete user guide and tutorials</p>
            <Button variant="outline" className="w-full bg-transparent">
              View Docs
            </Button>
          </Card>

          <Card className="bg-white border border-border/50 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 border border-primary/20 mb-4">
              <HelpCircle className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-foreground">Troubleshooting</h3>
            <p className="text-sm text-muted-foreground mb-4">Common issues and solutions</p>
            <Button variant="outline" className="w-full bg-transparent">
              View FAQs
            </Button>
          </Card>

          <Card className="bg-white border border-border/50 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 border border-primary/20 mb-4">
              <Mail className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-foreground">Email Support</h3>
            <p className="text-sm text-muted-foreground mb-4">claudio.private@gmail.com</p>
            <Button variant="outline" className="w-full bg-transparent" asChild>
              <a href="mailto:claudio.private@gmail.com">Contact</a>
            </Button>
          </Card>
        </div>
      </div>
    </section>
  )
}
