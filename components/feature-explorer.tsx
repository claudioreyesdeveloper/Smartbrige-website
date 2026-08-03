"use client"

import Image from "next/image"
import { useEffect, useMemo, useState } from "react"
import { ChevronDown, ChevronRight, FolderTree, Layers3 } from "lucide-react"
import { FEATURE_MODULES, PRODUCT_VIDEO_GUIDES } from "@/lib/site"

const FEATURE_GROUPS = Array.from(new Set(FEATURE_MODULES.map((module) => module.tag)))

function itemsForGroup(group: string) {
  return FEATURE_MODULES.filter((module) => module.tag === group)
}

export function FeatureExplorer() {
  const [active, setActive] = useState(FEATURE_MODULES[0].id)
  const [expandedGroup, setExpandedGroup] = useState(FEATURE_MODULES[0].tag)
  const [treeOpen, setTreeOpen] = useState(false)

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("feature")
    if (!requested) return

    const found = FEATURE_MODULES.find((item) => item.id === requested)
    if (!found) return

    setActive(found.id)
    setExpandedGroup(found.tag)
  }, [])

  const module = FEATURE_MODULES.find((item) => item.id === active) ?? FEATURE_MODULES[0]
  const activePosition = FEATURE_MODULES.findIndex((item) => item.id === module.id) + 1

  const relatedGuides = useMemo(
    () => PRODUCT_VIDEO_GUIDES.filter((guide) => guide.featureIds.includes(module.id)),
    [module.id],
  )

  const primaryGuide = relatedGuides[0]
  const primaryVideo = primaryGuide?.video ?? module.videos[0]

  function chooseFeature(id: string) {
    const next = FEATURE_MODULES.find((item) => item.id === id)
    if (!next) return

    setActive(id)
    setExpandedGroup(next.tag)
    setTreeOpen(false)

    const url = new URL(window.location.href)
    url.searchParams.set("feature", id)
    window.history.replaceState(null, "", url)
  }

  return (
    <div className="feature-explorer">
      <button
        type="button"
        className={`feature-tree-mobile-toggle${treeOpen ? " is-open" : ""}`}
        aria-expanded={treeOpen}
        aria-controls="desktop-feature-tree"
        onClick={() => setTreeOpen((isOpen) => !isOpen)}
      >
        <span>
          <small>Browse SmartBridge Desktop</small>
          <strong>{module.name}</strong>
        </span>
        <span>
          {module.tag}
          <ChevronDown size={16} />
        </span>
      </button>

      <div className="feature-browser">
        <aside
          id="desktop-feature-tree"
          className={`feature-tree-panel${treeOpen ? " is-open" : ""}`}
          aria-label="SmartBridge Desktop features"
        >
          <div className="feature-tree-root">
            <span><FolderTree size={17} /></span>
            <div>
              <strong>SmartBridge Desktop</strong>
              <small>{FEATURE_MODULES.length} connected tools</small>
            </div>
          </div>

          <nav className="feature-tree" aria-label="Desktop feature tree">
            {FEATURE_GROUPS.map((group) => {
              const groupItems = itemsForGroup(group)
              const isExpanded = expandedGroup === group
              const containsActive = module.tag === group

              return (
                <div key={group} className={`feature-tree-branch${containsActive ? " contains-active" : ""}`}>
                  <button
                    type="button"
                    className="feature-tree-group"
                    aria-expanded={isExpanded}
                    onClick={() => setExpandedGroup((current) => current === group ? "" : group)}
                  >
                    <span className="feature-tree-group-chevron">
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                    <span className="feature-tree-node" aria-hidden="true" />
                    <span className="feature-tree-group-name">{group}</span>
                    <span className="feature-tree-count">{groupItems.length}</span>
                  </button>

                  <div className="feature-tree-children" hidden={!isExpanded}>
                    {groupItems.map((item) => {
                      const isActive = item.id === module.id

                      return (
                        <button
                          key={item.id}
                          type="button"
                          className={`feature-tree-leaf${isActive ? " is-active" : ""}`}
                          aria-current={isActive ? "page" : undefined}
                          onClick={() => chooseFeature(item.id)}
                        >
                          <span className="feature-tree-leaf-node" aria-hidden="true" />
                          <span>{item.name}</span>
                          {isActive ? <ChevronRight size={13} /> : null}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </nav>
        </aside>

        <article id={module.id} className="feature-detail-card">
          <div className="feature-detail-head">
            <p className="ux-section-label">{module.tag} · {String(activePosition).padStart(2, "0")} / {FEATURE_MODULES.length}</p>
            <div><h3>{module.name}</h3><span><Layers3 size={15} /> SmartBridge Desktop v1.5</span></div>
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
                      <div className="flex items-start justify-between gap-4">
                        <p className="font-medium text-stone-100">{primaryVideo.title}</p>
                        <span className="shrink-0 text-xs uppercase tracking-[0.16em] text-stone-500">
                          {primaryVideo.duration}
                        </span>
                      </div>
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
                        <div className="flex items-start justify-between gap-4">
                          <p className="font-medium text-stone-100">{guide.title}</p>
                          <span className="shrink-0 text-xs uppercase tracking-[0.16em] text-stone-500">
                            {guide.video.duration}
                          </span>
                        </div>
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
                          <span className="flex items-start justify-between gap-4 font-medium text-stone-100">
                            <span>{entry.title}</span>
                            <span className="shrink-0 text-xs font-normal uppercase tracking-[0.16em] text-stone-500">
                              {video.duration}
                            </span>
                          </span>
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
