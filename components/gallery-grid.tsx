import Image from "next/image"
import { GALLERY } from "@/lib/site"

export function GalleryGrid() {
  return (
    <section className="section-block" style={{ borderTop: "1px solid var(--color-border)" }}>
      <div className="content-wrap">
        <div style={{ maxWidth: "42rem" }}>
          <p className="section-label">Screens</p>
          <h2 className="section-title" style={{ marginTop: "0.75rem" }}>See it in context</h2>
          <p className="prose-muted" style={{ marginTop: "1rem" }}>
            Every screen is tied to a step in the arrangement workflow — not isolated tools.
          </p>
        </div>
        <div className="gallery-grid" style={{ marginTop: "3rem" }}>
          {GALLERY.map((item) => (
            <figure key={item.src} className="card-surface" style={{ overflow: "hidden" }}>
              <Image src={item.src} alt={item.caption} width={800} height={500} style={{ width: "100%", objectFit: "cover" }} />
              <figcaption className="prose-muted" style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", borderTop: "1px solid var(--color-border)" }}>
                {item.caption}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
