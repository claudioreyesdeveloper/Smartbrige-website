import { Book, MessageCircle, FileText, Video } from "lucide-react"

export function SupportDocs() {
  const resources = [
    {
      icon: Book,
      title: "Documentation",
      description: "Comprehensive guides and API reference",
      link: "#",
    },
    {
      icon: Video,
      title: "Video Tutorials",
      description: "Step-by-step walkthroughs",
      link: "#",
    },
    {
      icon: MessageCircle,
      title: "Community Forum",
      description: "Connect with other users",
      link: "#",
    },
    {
      icon: FileText,
      title: "FAQ",
      description: "Common questions answered",
      link: "#",
    },
  ]

  return (
    <section id="support" className="py-24 px-6">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-foreground mb-4">Support & Documentation</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Everything you need to get the most out of SmartBridge.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {resources.map((resource) => (
            <a
              key={resource.title}
              href={resource.link}
              className="p-6 border border-border rounded-lg bg-card hover:border-primary/50 transition-all duration-300 group"
            >
              <resource.icon
                className="w-8 h-8 text-primary mb-3 group-hover:scale-110 transition-transform"
                strokeWidth={1.5}
              />
              <h3 className="text-lg font-semibold text-foreground mb-2">{resource.title}</h3>
              <p className="text-sm text-muted-foreground">{resource.description}</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
