export function Hero() {
  return (
    <section className="relative pt-32 pb-20 px-4 min-h-[80vh] flex items-center bg-gradient-to-b from-background via-background to-muted/20">
      {/* Subtle background image */}
      <div className="absolute inset-0 z-0 opacity-10">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/60 to-background" />
      </div>

      <div className="container mx-auto relative z-10 max-w-4xl">
        <div className="text-center space-y-8">
          <h1 className="text-4xl md:text-6xl font-bold text-foreground leading-tight text-balance">SmartBridge</h1>

          <p className="text-lg md:text-xl text-muted-foreground font-medium">
            Control Environment for Yamaha PSR, Tyros, and Genos
          </p>

          <div className="max-w-3xl mx-auto space-y-6 text-base md:text-lg text-foreground/90 leading-relaxed">
            <p className="text-pretty">
              SmartBridge is the control environment I wished for when playing my PSR, Tyros, and Genos. It fuses the
              precision of Yamaha's hardware with modern UI design, giving you full, fast control over performance,
              sound, and mixing through an elegant, touch-ready interface.
            </p>

            <p className="text-pretty">
              Tired of digging through menus? SmartBridge is the dedicated web-based controller that finally gives you
              full, instant access to your Yamaha arranger's voices and controls. Built with modern, high-performance
              technology, it provides a responsive, stage-optimized UI that works seamlessly on your tablet or desktop.
              It's the integrated toolkit designed to streamline your workflow for both live performance and studio
              arrangement.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
