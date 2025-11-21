export function Contact() {
  return (
    <section className="py-20 px-4 bg-muted/20">
      <div className="container mx-auto max-w-3xl text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-8 text-foreground">Contact</h2>

        <div className="space-y-6 text-base md:text-lg text-foreground/90 leading-relaxed">
          <p className="text-pretty">
            If you're interested in the project or wish to exchange ideas about Yamaha integration, you are welcome to
            reach out.
          </p>

          <div className="glass-panel rounded-2xl p-8 inline-block">
            <p className="text-foreground font-medium">
              Email:{" "}
              <a href="mailto:claudio.private@gmail.com" className="text-primary hover:underline">
                claudio.private@gmail.com
              </a>
            </p>
          </div>

          <p className="text-sm text-muted-foreground italic">(No commercial inquiries, please.)</p>
        </div>
      </div>
    </section>
  )
}
