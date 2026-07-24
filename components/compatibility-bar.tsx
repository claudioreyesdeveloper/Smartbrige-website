import { COMPAT, KEYBOARDS } from "@/lib/site"

export function CompatibilityBar() {
  return (
    <section className="section-block">
      <div className="content-wrap">
        <div className="card-surface compat-grid" style={{ padding: "1.5rem" }}>
          <div>
            <p className="section-label">Compatibility</p>
            <h2 className="section-title" style={{ marginTop: "0.75rem" }}>Built for your rig</h2>
            <p className="prose-muted" style={{ marginTop: "1rem" }}>
              VST3 or standalone. Setup installs the plugin, phrase library, Cubase scripts, and SynthV side panel.
            </p>
            <div className="compat-tags">
              {KEYBOARDS.map((kb) => (
                <span key={kb} className="compat-tag">{kb}</span>
              ))}
            </div>
          </div>
          <div className="compat-mini-grid">
            <CompatBlock title="Platforms" items={COMPAT.platforms} />
            <CompatBlock title="Formats" items={COMPAT.formats} />
            <CompatBlock title="DAWs" items={COMPAT.daws} />
            <CompatBlock title="Integrations" items={COMPAT.integrations} />
          </div>
        </div>
      </div>
    </section>
  )
}

function CompatBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "#e2e8f0" }}>{title}</h3>
      <ul style={{ margin: "0.5rem 0 0", padding: 0, listStyle: "none", fontSize: "0.875rem", color: "var(--color-muted)" }}>
        {items.map((item) => (
          <li key={item} style={{ marginTop: "0.35rem" }}>{item}</li>
        ))}
      </ul>
    </div>
  )
}
