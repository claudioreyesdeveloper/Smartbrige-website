import { PILLARS } from "@/lib/site"

export function PillarCards() {
  return (
    <section className="section-block" style={{ borderTop: "1px solid var(--color-border)", borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
      <div className="content-wrap">
        <div style={{ maxWidth: "42rem" }}>
          <p className="section-label">Why it&apos;s different</p>
          <h2 className="section-title" style={{ marginTop: "0.75rem" }}>Not another loop player</h2>
          <p className="prose-muted" style={{ marginTop: "1rem" }}>
            Most keyboard software manages sounds or plays back loops. SmartBridge is built around
            the full creative process — from the first chord to a structured arrangement.
          </p>
        </div>
        <div className="pillar-grid" style={{ marginTop: "3rem" }}>
          {PILLARS.map((pillar) => (
            <article key={pillar.id} className="card-surface" style={{ padding: "1.5rem" }}>
              <h3 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#f8fafc" }}>{pillar.title}</h3>
              <p style={{ marginTop: "0.25rem", fontSize: "0.875rem", color: "var(--color-accent-soft)" }}>{pillar.summary}</p>
              <p className="prose-muted" style={{ marginTop: "0.75rem", fontSize: "0.875rem" }}>{pillar.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
