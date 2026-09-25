import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight,
  Cable,
  Layers3,
  MessageSquareText,
  Music2,
  PlayCircle,
  WandSparkles,
} from "lucide-react"
import { CommunityPreview } from "@/components/community/community-preview"
import { FEATURE_STORIES } from "@/lib/feature-stories"
import { SITE, VIDEO_LIBRARY } from "@/lib/site"

const doors = [
  {
    icon: Music2,
    title: "Write and develop the song",
    body: "Build the progression, capture your own sections and develop the harmony before arranging around it.",
    slugs: ["song-and-chords", "chord-intelligence", "jam-session"],
  },
  {
    icon: WandSparkles,
    title: "Build the arrangement",
    body: "Add performed rhythm parts, solos, vocals, lyrics, harmonies, brass and strings against the same song.",
    slugs: ["performance-library", "solo-studio", "vocal-composer"],
  },
  {
    icon: Cable,
    title: "Connect Yamaha to production",
    body: "Keep the real Yamaha voices, effects, Motif ideas, native styles and Cubase tracks organised.",
    slugs: ["yamaha-cubase", "motif-style-creation"],
  },
]

const products = [
  {
    name: "SmartBridge Desktop",
    body: "The complete connected song-production environment for Yamaha musicians working with a DAW.",
    href: "/explore",
    cta: "Explore Desktop",
  },
  {
    name: "Style Maker",
    body: "Create and rebuild native Yamaha accompaniment styles in the browser.",
    href: "/style-maker",
    cta: "Open Style Maker",
  },
  {
    name: "Jam Player",
    body: "Practise directly in the browser with chord progressions and a musical backing band.",
    href: "/jam-player",
    cta: "Open Jam Player",
  },
]

export default function HomePage() {
  const highlighted = ["song-and-chords", "solo-studio", "vocal-composer", "yamaha-cubase"]
    .map((slug) => FEATURE_STORIES.find((story) => story.slug === slug))
    .filter((story): story is NonNullable<typeof story> => Boolean(story))

  return (
    <div className="marketing-page">
      <section className="overflow-hidden border-b border-white/10 bg-[#0d0f0c] text-white">
        <div className="m-wrap grid gap-12 py-16 lg:grid-cols-[.95fr_1.05fr] lg:items-center lg:py-24">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.04] px-3 py-1.5 text-xs font-semibold uppercase tracking-[.16em] text-white/55">
              <span className="size-1.5 rounded-full bg-[#c9f46a]" />
              One song. Every part understands it.
            </div>
            <h1 className="mt-6 max-w-4xl font-[family-name:var(--font-instrument-serif)] text-5xl leading-[.93] md:text-7xl">
              Turn Yamaha ideas into working productions.
              <span className="mt-2 block text-[#c9f46a]">Then help shape what SmartBridge becomes.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/65">
              SmartBridge keeps the chords, sections, key and tempo connected while you move through
              Yamaha hardware, performed MIDI, Cubase, Synthesizer V, solos, vocals and harmony.
              Every major feature now has a video and an open feedback discussion.
            </p>
            <div className="m-actions mt-8">
              <Link href="/explore" className="m-button m-button-primary">
                Explore the real workflows <ArrowRight size={17} />
              </Link>
              <Link href="/build-with-us" className="m-button m-button-outline-light">
                Help build SmartBridge <MessageSquareText size={17} />
              </Link>
            </div>
          </div>

          <div>
            <div className="overflow-hidden rounded-[1.7rem] border border-white/10 bg-black shadow-[0_30px_100px_rgba(0,0,0,.35)]">
              <iframe
                className="aspect-video w-full"
                src={`https://www.youtube.com/embed/${VIDEO_LIBRARY.intro.youtubeId}?rel=0`}
                title={VIDEO_LIBRARY.intro.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 text-xs text-white/40">
              <span className="inline-flex items-center gap-2"><PlayCircle size={14} /> Introduction to SmartBridge</span>
              <span>{VIDEO_LIBRARY.intro.duration}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="m-section bg-white">
        <div className="m-wrap">
          <div className="max-w-3xl">
            <p className="m-eyebrow">Start with the job</p>
            <h2 className="mt-3 font-[family-name:var(--font-instrument-serif)] text-4xl text-[#151712] md:text-5xl">
              You do not need to understand the SmartBridge architecture before you use it.
            </h2>
          </div>

          <div className="mt-9 grid gap-5 lg:grid-cols-3">
            {doors.map((door) => (
              <article key={door.title} className="rounded-[1.6rem] border border-black/10 bg-[#f3f2ec] p-6 md:p-7">
                <door.icon size={23} className="text-[#667d25]" />
                <h3 className="mt-5 font-[family-name:var(--font-instrument-serif)] text-3xl text-[#151712]">{door.title}</h3>
                <p className="mt-3 leading-7 text-black/55">{door.body}</p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {door.slugs.map((slug) => {
                    const story = FEATURE_STORIES.find((item) => item.slug === slug)
                    if (!story) return null
                    return (
                      <Link key={slug} href={`/explore/${slug}`} className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-black/55 transition hover:border-black/30">
                        {story.title}
                      </Link>
                    )
                  })}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="m-section bg-[#ecebe4]">
        <div className="m-wrap">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div className="max-w-3xl">
              <p className="m-eyebrow">See something real</p>
              <h2 className="mt-3 font-[family-name:var(--font-instrument-serif)] text-4xl text-[#151712] md:text-5xl">
                Each feature is explained as a musical workflow, not a specification list.
              </h2>
            </div>
            <Link href="/explore" className="m-button m-button-ink">See all features <ArrowRight size={16} /></Link>
          </div>

          <div className="mt-9 grid gap-5 md:grid-cols-2">
            {highlighted.map((story) => (
              <Link
                key={story.slug}
                href={`/explore/${story.slug}`}
                className="group overflow-hidden rounded-[1.6rem] border border-black/10 bg-white"
              >
                <Image
                  src={story.image}
                  alt={story.title}
                  width={1100}
                  height={700}
                  className="aspect-[16/9] w-full object-cover transition duration-500 group-hover:scale-[1.015]"
                />
                <div className="p-6">
                  <span className="text-xs font-semibold uppercase tracking-[.16em] text-black/40">{story.group} · {story.eyebrow}</span>
                  <h3 className="mt-2 font-[family-name:var(--font-instrument-serif)] text-3xl text-[#151712]">{story.title}</h3>
                  <p className="mt-2 leading-6 text-black/50">{story.summary}</p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#52651f]">
                    Watch and discuss <ArrowRight size={14} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="m-section bg-[#0d0f0c] text-white">
        <div className="m-wrap grid gap-10 lg:grid-cols-[.85fr_1.15fr]">
          <div>
            <p className="m-eyebrow">Built with musicians</p>
            <h2 className="mt-3 font-[family-name:var(--font-instrument-serif)] text-4xl md:text-5xl">
              Feedback should lead somewhere visible.
            </h2>
            <p className="mt-5 max-w-xl leading-7 text-white/55">
              Comments stay attached to the feature that triggered them. Suggestions can be voted on
              without an account, Claudio can reply publicly, and the status can move from review to
              planned, building and shipped.
            </p>
            <Link href="/build-with-us" className="m-button m-button-outline-light mt-7 inline-flex">
              Open Build with us <ArrowRight size={16} />
            </Link>
          </div>
          <CommunityPreview />
        </div>
      </section>

      <section className="m-section bg-white">
        <div className="m-wrap">
          <div className="max-w-3xl">
            <p className="m-eyebrow">One product family</p>
            <h2 className="mt-3 font-[family-name:var(--font-instrument-serif)] text-4xl text-[#151712]">
              Choose the entry point that matches the job.
            </h2>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {products.map((product) => (
              <article key={product.name} className="rounded-2xl border border-black/10 p-6">
                <Layers3 size={20} className="text-[#667d25]" />
                <h3 className="mt-4 text-xl font-semibold text-[#151712]">{product.name}</h3>
                <p className="mt-2 min-h-20 text-sm leading-6 text-black/50">{product.body}</p>
                <Link href={product.href} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#52651f]">
                  {product.cta} <ArrowRight size={14} />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="m-final-cta">
        <div className="m-wrap m-final-cta-inner">
          <p className="m-eyebrow">SmartBridge Desktop</p>
          <h2>Keep the Yamaha idea connected until the production is finished.</h2>
          <div className="m-actions">
            <Link href="/explore" className="m-button m-button-primary">Explore Desktop <ArrowRight size={17} /></Link>
            <a href={SITE.setupUrl} target="_blank" rel="noopener noreferrer" className="m-button m-button-outline-light">Download Setup</a>
            <Link href="/build-with-us" className="m-button m-button-outline-light">Give feedback</Link>
          </div>
        </div>
      </section>
    </div>
  )
}
