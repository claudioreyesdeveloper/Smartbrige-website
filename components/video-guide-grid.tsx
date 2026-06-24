import Link from "next/link"
import { PRODUCT_VIDEO_GUIDES, FEATURE_MODULES } from "@/lib/site"

export function VideoGuideGrid() {
  return (
    <section id="video-guides" className="section-block" style={{ paddingTop: 0 }}>
      <div className="content-wrap">
        <div style={{ maxWidth: "48rem" }}>
          <p className="section-label">Video walkthroughs</p>
          <h2 className="section-title" style={{ marginTop: "0.75rem" }}>
            Claudio’s actual YouTube demos, mapped to the product
          </h2>
          <p className="prose-muted" style={{ marginTop: "1rem" }}>
            These are real SmartBridge walkthroughs from Claudio’s channel. Each card links straight
            to the YouTube video and points back to the matching product areas, so visitors can go
            from a feature explanation to the exact demo that shows it in use.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {PRODUCT_VIDEO_GUIDES.map((guide) => {
            const related = guide.featureIds
              .map((id) => FEATURE_MODULES.find((item) => item.id === id))
              .filter((item): item is NonNullable<typeof item> => Boolean(item))

            return (
              <article key={guide.video.url} className="card-surface p-6">
                <a
                  href={guide.video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: "block" }}
                >
                  <img
                    src={`https://i.ytimg.com/vi/${guide.video.youtubeId}/hqdefault.jpg`}
                    alt={guide.title}
                    loading="lazy"
                    style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover", borderRadius: "1rem" }}
                  />
                </a>

                <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
                  <div style={{ maxWidth: "36rem" }}>
                    <h3 className="font-semibold text-stone-100">{guide.title}</h3>
                    <p className="mt-3 text-sm prose-muted">{guide.summary}</p>
                  </div>
                  <a
                    href={guide.video.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary"
                  >
                    Watch on YouTube
                  </a>
                </div>

                {related.length > 0 ? (
                  <div className="mt-5">
                    <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                      Related product features
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {related.map((feature) => (
                        <Link
                          key={feature.id}
                          href={`/features?feature=${feature.id}`}
                          className="feature-filter-btn"
                        >
                          {feature.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
