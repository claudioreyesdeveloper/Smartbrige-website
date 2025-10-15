import { Button } from "@/components/ui/button"
import { MessageSquare, Users } from "lucide-react"

export function CommunityCollaboration() {
  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6 bg-muted/30">
      <div className="container mx-auto max-w-4xl text-center">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-6">
          Built Together with the Yamaha Community.
        </h2>

        <p className="text-base sm:text-lg md:text-xl text-foreground/90 leading-relaxed max-w-3xl mx-auto mb-10">
          Although SmartBridge started as a private project, it now grows through user feedback and collaboration.
          <br className="hidden sm:block" />
          Every idea or comment helps shape the future — from performance features to new creative tools.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
          <Button size="lg" className="gap-2">
            <MessageSquare className="w-4 h-4" />
            Leave Feedback
          </Button>
          <Button size="lg" variant="outline" className="gap-2 bg-transparent">
            <Users className="w-4 h-4" />
            Join Development Conversation
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          Email:{" "}
          <a href="mailto:claudio.private@gmail.com" className="text-primary hover:underline">
            claudio.private@gmail.com
          </a>
        </p>
      </div>
    </section>
  )
}
