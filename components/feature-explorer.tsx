"use client"

import Image from "next/image"
import { useEffect, useState } from "react"
import { FEATURE_MODULES } from "@/lib/site"

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
            <p className="section-label">{module.tag}</p>
            <h3 className="section-title" style={{ fontSize: "1.5rem", marginTop: "0.5rem" }}>
              {module.name}
            </h3>
          </div>
          <div className="feature-detail-body">
            <Image
              src={module.image}
              alt={module.name}
              width={800}
              height={500}
              className="feature-detail-img"
            />
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
              <div>
                <h4>Watch it in Claudio’s demos</h4>
                <div style={{ display: "grid", gap: "0.75rem" }}>
                  {module.videos.map((video) => (
                    <a
                      key={video.url}
                      href={video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="card-surface"
                      style={{ padding: "0.9rem 1rem", display: "block" }}
                    >
                      <span className="font-medium text-stone-100">{video.title}</span>
                      {video.note ? (
                        <span className="mt-1 block text-sm text-stone-400">{video.note}</span>
                      ) : null}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </article>
      </div>
    </div>
  )
}
