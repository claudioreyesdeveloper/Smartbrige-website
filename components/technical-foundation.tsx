import { Cpu, Zap, Shield } from "lucide-react"

export function TechnicalFoundation() {
  return (
    <section className="py-24 px-6">
      <div className="container mx-auto max-w-6xl">
        <h2 className="text-4xl font-bold text-foreground mb-12 text-center">Technical Foundation</h2>

        <div className="grid md:grid-cols-2 gap-12">
          <div>
            <h3 className="text-2xl font-semibold text-foreground mb-4">Yamaha Compatibility</h3>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              Built specifically for Yamaha PSR-SX and Genos series keyboards. SmartBridge speaks the native language of
              your instrument, ensuring seamless integration and reliable performance.
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Cpu className="w-5 h-5 text-primary" strokeWidth={1.5} />
                <span className="text-foreground">PSR-SX900, SX700, SX600</span>
              </div>
              <div className="flex items-center gap-3">
                <Cpu className="w-5 h-5 text-primary" strokeWidth={1.5} />
                <span className="text-foreground">Genos, Genos2</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-2xl font-semibold text-foreground mb-4">Performance</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Zap className="w-5 h-5 text-primary mt-1" strokeWidth={1.5} />
                <div>
                  <p className="text-foreground font-medium">Low Latency</p>
                  <p className="text-sm text-muted-foreground">Real-time MIDI communication with minimal delay</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-primary mt-1" strokeWidth={1.5} />
                <div>
                  <p className="text-foreground font-medium">Stable Connection</p>
                  <p className="text-sm text-muted-foreground">Robust USB-MIDI implementation</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
