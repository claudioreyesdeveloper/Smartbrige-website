import { Card } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

export function PricingSection() {
  const editions = [
    { name: "Standalone", price: "$69", description: "Desktop application" },
    { name: "VST Plugin", price: "$99", description: "DAW integration" },
    { name: "iPad (iOS)", price: "$49", description: "Touch-optimized" },
    { name: "All Platforms Bundle", price: "$149", description: "Complete package" },
  ]

  const faqs = [
    {
      question: "Why is there a price?",
      answer: "SmartBridge is actively maintained; pricing funds Yamaha compatibility and feature development.",
    },
    {
      question: "What's included in my license?",
      answer: "Perpetual access to the purchased edition and all minor updates.",
    },
    {
      question: "Can I upgrade editions later?",
      answer: "Yes — pay only the difference to move to another edition or the bundle.",
    },
    {
      question: "Is my keyboard supported?",
      answer: "Works with Yamaha PSR, Genos, and Tyros. Future updates will expand compatibility.",
    },
    {
      question: "Do I need an internet connection?",
      answer: "Only for activation and updates. Offline operation is fully supported.",
    },
    {
      question: "Can I try it before buying?",
      answer: "Yes — the GUI mockup demo is available online.",
    },
    {
      question: "Will SmartBridge integrate with MIDI and DAWs?",
      answer: "Yes — upcoming releases include full MIDI and DAW support.",
    },
    {
      question: "How do I get support?",
      answer: "Use the feedback form or email claudio.private@gmail.com.",
    },
    {
      question: "Can I move my license between computers?",
      answer: "Yes — deactivate on one device and reactivate on another.",
    },
    {
      question: "What if I upgrade my keyboard?",
      answer: "Compatibility updates for new Yamaha models will be provided at reduced upgrade pricing.",
    },
  ]

  return (
    <section className="py-20 px-4 bg-muted/30">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">Simple, Transparent Pricing</h2>
          <p className="text-xl text-black max-w-3xl mx-auto leading-relaxed">
            No subscriptions. You own your license. Minor updates are free; major upgrades are optional.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {editions.map((edition) => (
            <Card
              key={edition.name}
              className="bg-white border border-border/50 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-6 hover:border-primary/60"
            >
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold mb-2 text-foreground">{edition.name}</h3>
                <div className="text-4xl font-bold text-primary my-4">{edition.price}</div>
                <p className="text-sm text-black leading-relaxed">{edition.description}</p>
              </div>
            </Card>
          ))}
        </div>

        <div className="bg-white border border-border/50 rounded-2xl shadow-lg transition-all duration-300 p-8 max-w-3xl mx-auto mb-12">
          <div className="space-y-3 text-sm text-black">
            <p>Free 7-day trial or 14-day refund available.</p>
          </div>
        </div>

        <div className="max-w-3xl mx-auto">
          <h3 className="text-3xl font-bold mb-6 text-center text-foreground">Questions & Answers</h3>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="border-border">
                <AccordionTrigger className="text-left hover:text-primary transition-colors">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-black leading-relaxed">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  )
}
