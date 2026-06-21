import { WORKFLOW_STEPS } from "@/lib/site"

export function WorkflowStrip() {
  return (
    <section className="section-block">
      <div className="content-wrap">
        <div style={{ maxWidth: "42rem" }}>
          <p className="section-label">The workflow</p>
          <h2 className="section-title" style={{ marginTop: "0.75rem" }}>One path from idea to production</h2>
          <p className="prose-muted" style={{ marginTop: "1rem" }}>
            Start with a pop progression, layer brass and guitar phrases, sketch a verse vocal,
            then export stems to Cubase.
          </p>
        </div>
        <ol className="workflow-grid" style={{ marginTop: "3rem", listStyle: "none", padding: 0 }}>
          {WORKFLOW_STEPS.map((step) => (
            <li key={step.step} className="card-surface" style={{ padding: "1.25rem" }}>
              <span className="section-label">{step.step}</span>
              <h3 style={{ marginTop: "0.5rem", fontWeight: 600, color: "#f1f5f9" }}>{step.title}</h3>
              <p className="prose-muted" style={{ marginTop: "0.5rem", fontSize: "0.875rem" }}>{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
