"use client"

import Image from "next/image"
import { useEffect, useMemo, useState } from "react"
import { FEATURE_MODULES, PRODUCT_VIDEO_GUIDES } from "@/lib/site"

const TAGS = ["All", ...Array.from(new Set(FEATURE_MODULES.map((m) => m.tag)))]

function itemsForTag(tag: string) {
  return tag === "All" ? FEATURE_MODULES : FEATURE_MODULES.filter((m) => m.tag === tag)
}

export function FeatureExplorer() {
  const [filter, setFilter] = useState("All")
  const [active, setActive] = useState(FEATURE_MODULES[0].id)

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("feature")
    if (!requested) return

    const found = FEATURE_MODULES.find((item) => item.id === requested)
    if (!found) return

    setFilter("All")
    setActive(found.id)
  }, [])

  const filtered = itemsForTag(filter)
  const module = filtered.find((m) => m.id === active) ?? filtered[0] ?? FEATURE_MODULES[0]

  const relatedGuides = useMemo(
    () => PRODUCT_VIDEO_GUIDES.filter((guide) => guide.featureIds.includes(module.id)),
    [module.id],
  )

  const primaryGuide = relatedGuides[0]
  const primaryVideo = primaryGuide?.video ?? module.videos[0]

  function pickFilter(tag: string) {
    setFilter(tag)
    const next = itemsForTag(tag)
    setActive(next[0]?.id ?? FEATURE_MODULES[0].id)
  }

  return (
    <div className="feature-explorer">
      <div className="feature-filters">
        {TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => pickFilter(tag)}
            className={`feature-filter-btn${filter === tag ? " is-active" : ""}`}
          >
            {tag}
          </button>
        ))}
      </div>

      <div className="feature-layout">
        <ul className="feature-list">
          {filtered.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setActive(item.id)}
                className={`feature-list-btn${active === item.id ? " is-active" : ""}`}
              >
                <span className="feature-list-name">{item.name}</span>
                <span className="feature-list-tag">{item.tag}</span>
              </button>
            </li>
          ))}
        </ul>

        <article id={module.id} className="card-surface" style={{ overflow: "hidden" }}>
          <div className="feature-detail-head">
            <p className="ux-section-label">{module.tag}</p>
            <h3 className="section-title" style={{ fontSize: "1.5rem", marginTop: "0.65rem" }}>
              {module.name}
            </h3>
          </div>

          <div className="feature-detail-body" style={{ alignItems: "start" }}>
            <div style={{ display: "grid", gap: "1rem" }}>
              <Image
                src={module.image}
                alt={module.name}
                width={800}
                height={500}
                className="feature-detail-img"
              />

              {primaryVideo ? (
                <div>
                  <h4>Watch the feature in action</h4>
                  <div
                    className="card-surface"
                    style={{
                      overflow: "hidden",
                      padding: 0,
                      marginTop: "0.85rem",
                      borderColor: "rgba(74, 158, 255, 0.22)",
                    }}
                  >
                    <div style={{ position: "relative", width: "100%", paddingTop: "56.25%" }}>
                      <iframe
                        src={`https://www.youtube-nocookie.com/embed/${primaryVideo.youtubeId}`}
                        title={primaryVideo.title}
                        loading="lazy"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
                      />
                    </div>
                    <div style={{ padding: "1rem" }}>
                      <p className="font-medium text-stone-100">{primaryVideo.title}</p>
                      <p className="mt-2 text-sm prose-muted">
                        {primaryGuide?.summary ?? primaryVideo.note ?? "A direct SmartBridge walkthrough from Claudio’s YouTube channel."}
                      </p>
                      <div className="btn-row" style={{ marginTop: "0.9rem" }}>
                        <a
                          href={primaryVideo.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary"
                        >
                          Watch on YouTube
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="feature-detail-text">
              <div>
                <h4>What it is</h4>
                <p className="prose-muted">{module.what}</p>
              </div>
              <div>
                <h4>Why it matters for you</h4>
                <p className="prose-muted">{module.why}</p>
              </div>
              <div>
                <h4>What you can do with it</h4>
                <ul className="prose-muted" style={{ paddingLeft: "1.125rem", display: "grid", gap: "0.6rem" }}>
                  {module.highlights.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              {relatedGuides.length > 0 ? (
                <div>
                  <h4>What Claudio shows in the demos</h4>
                  <div style={{ display: "grid", gap: "0.75rem" }}>
                    {relatedGuides.slice(0, 3).map((guide) => (
                      <div key={guide.video.url} className="card-surface" style={{ padding: "0.9rem 1rem" }}>
                        <p className="font-medium text-stone-100">{guide.title}</p>
                        <p className="mt-2 text-sm prose-muted">{guide.summary}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div>
                <h4>Related YouTube videos</h4>
                <div style={{ display: "grid", gap: "0.9rem" }}>
                  {(relatedGuides.length > 0 ? relatedGuides : module.videos.map((video) => ({ video, title: video.title, summary: video.note ?? "A SmartBridge walkthrough from Claudio’s YouTube channel." }))).map((entry) => {
                    const video = entry.video
                    return (
                      <a
                        key={video.url}
                        href={video.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="card-surface"
                        style={{ padding: "0.9rem", display: "grid", gap: "0.8rem" }}
                      >
                        <img
                          src={`https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`}
                          alt={video.title}
                          loading="lazy"
                          style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover", borderRadius: "1rem" }}
                        />
                        <div>
                          <span className="font-medium text-stone-100">{entry.title}</span>
                          <span className="mt-2 block text-sm text-stone-400">{entry.summary}</span>
                        </div>
                      </a>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </article>
      </div>
    </div>
  )
}
