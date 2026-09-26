import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  MessageSquareText,
  PlayCircle,
  Users,
  Vote,
  Wrench,
} from "lucide-react"
import { CommunityPreview } from "@/components/community/community-preview"
import { FEATURE_STORIES } from "@/lib/feature-stories"
import { SITE, VIDEO_LIBRARY } from "@/lib/site"

const openQuestions = [
  {
    slug: "solo-studio",
    question: "Does Solo Studio give you enough control after a take is generated?",
  },
  {
    slug: "phrase-riff-editor",
    question: "Which phrase-editing or articulation steps still feel too complicated?",
  },
  {
    slug: "vocal-composer",
    question: "What would make the vocal workflow faster or more useful for real songwriting?",
  },
  {
    slug: "chord-intelligence",
    question: "Which harmonic suggestions help—and which ones get in the way?",
  },
  {
    slug: "performance-library",
    question: "Can you find the right bass, drum or guitar performance quickly enough?",
  },
  {
    slug: "yamaha-cubase",
    question: "Which Yamaha-to-Cubase problems does SmartBridge still not solve for you?",
  },
]

const participation = [
  {
    icon: Eye,
    number: "01",
    title: "Watch the real feature",
    body: "Each feature has a current walkthrough. I want you reacting to what SmartBridge actually does—not a marketing promise.",
  },
  {
    icon: MessageSquareText,
    number: "02",
    title: "Tell me what to change",
    body: "Tell me what is useful, confusing, missing, unnecessary or too difficult. You can even attach your comment to a specific moment in the video.",
  },
  {
    icon: Vote,
    number: "03",
    title: "Help set priorities",
    body: "Vote on other musicians’ suggestions. I use that signal to understand which problems matter to more than one person.",
  },
  {
    icon: Wrench,
    number: "04",
    title: "See what happens",
    body: "I reply publicly and move ideas through Under review, Planned, Building and Shipped so you can see whether the input changed the product.",
  },
]

const decisions = [
  "Which workflows are genuinely valuable?",
  "What is too complex and should be simplified?",
  "What is missing from your real music-making workflow?",
  "Which features should I spend development time on next?",
]

export default function HomePage() {
  const questionStories = openQuestions
    .map((entry) => ({
      entry,
      story: FEATURE_STORIES.find((story) => story.slug === entry.slug),
    }))
    .filter((item): item is { entry: (typeof openQuestions)[number]; story: NonNullable<typeof item.story> } => Boolean(item.story))

  return (
    <div className="marketing-page">
      <section className="overflow-hidden border-b border-white/10 bg-[#0d0f0c] text-white">
        <div className="m-wrap py-14 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-[1.08fr_.92fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#c9f46a]/25 bg-[#c9f46a]/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[.16em] text-[#c9f46a]">
                <Users size={14} />
                Open development · No account required
              </div>
              <h1 className="mt-6 max-w-5xl font-[family-name:var(--font-instrument-serif)] text-5xl leading-[.92] md:text-7xl lg:text-[5.4rem]">
                Help me decide
                <span className="block text-[#c9f46a]">what SmartBridge becomes.</span>
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-white/68 md:text-xl">
                I am building SmartBridge in public because I want musicians—not just me—to help
                direct the product. I need your input on specific features: what is genuinely useful,
                what is too complicated, what is missing, and where I should spend development time next.
              </p>
              <p className="mt-4 max-w-3xl text-base leading-7 text-white/48">
                This is not a review form at the end of a finished product. SmartBridge is still
                evolving. Your comments, suggestions and votes are intended to influence what I simplify,
                improve and build.
              </p>
              <div className="m-actions mt-8">
                <Link href="#features-needing-input" className="m-button m-button-primary">
                  Show me where you need input <ArrowRight size={17} />
                </Link>
                <Link href="/build-with-us" className="m-button m-button-outline-light">
                  See the community discussion <MessageSquareText size={17} />
                </Link>
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-white/10 bg-white/[.045] p-6 md:p-8">
              <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#c9f46a]">How this site works</p>
              <h2 className="mt-3 font-[family-name:var(--font-instrument-serif)] text-3xl md:text-4xl">
                Watch. Challenge it. Help direct it.
              </h2>
              <div className="mt-6 grid gap-4">
                {participation.map((item) => (
                  <div key={item.number} className="grid grid-cols-[42px_1fr] gap-4 border-t border-white/10 pt-4 first:border-t-0 first:pt-0">
                    <div className="flex size-10 items-center justify-center rounded-full bg-[#c9f46a] text-[#151712]">
                      <item.icon size={17} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold tracking-[.16em] text-white/30">{item.number}</span>
                        <strong className="text-sm text-white">{item.title}</strong>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-white/48">{item.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-10 grid gap-3 border-t border-white/10 pt-6 sm:grid-cols-2 lg:grid-cols-4">
            {["Feature-specific questions", "Anonymous comments", "Community voting", "Public development status"].map((item) => (
              <span key={item} className="inline-flex items-center gap-2 text-sm text-white/45">
                <CheckCircle2 size={14} className="text-[#c9f46a]" /> {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section id="features-needing-input" className="m-section bg-[#f3f2ec]">
        <div className="m-wrap">
          <div className="grid gap-6 lg:grid-cols-[.78fr_1.22fr] lg:items-end">
            <div>
              <p className="m-eyebrow">Where I need your input now</p>
              <h2 className="mt-3 font-[family-name:var(--font-instrument-serif)] text-4xl leading-tight text-[#151712] md:text-5xl">
                These are not feature advertisements.
                <span className="block text-[#667d25]">They are open product questions.</span>
              </h2>
            </div>
            <p className="max-w-2xl text-lg leading-8 text-black/55 lg:justify-self-end">
              Open a feature, watch the current implementation, and answer the question I am trying
              to resolve. If my question is wrong, tell me that too. I want evidence from real
              musicians before I decide the next version.
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            {questionStories.map(({ entry, story }) => (
              <article key={story.slug} className="overflow-hidden rounded-[1.6rem] border border-black/10 bg-white shadow-[0_18px_50px_rgba(20,24,18,.055)]">
                <div className="grid md:grid-cols-[.82fr_1.18fr]">
                  <Link href={`/explore/${story.slug}`} className="block overflow-hidden bg-[#151712]">
                    <Image
                      src={story.image}
                      alt={story.title}
                      width={720}
                      height={720}
                      className="h-full min-h-52 w-full object-cover transition duration-500 hover:scale-[1.02]"
                    />
                  </Link>
                  <div className="p-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#dff2a9] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[.12em] text-[#43521d]">
                        Input wanted
                      </span>
                      <span className="text-xs text-black/35">{story.eyebrow}</span>
                    </div>
                    <h3 className="mt-3 font-[family-name:var(--font-instrument-serif)] text-3xl text-[#151712]">{story.title}</h3>
                    <p className="mt-3 text-base font-semibold leading-6 text-black/72">{entry.question}</p>
                    <p className="mt-3 text-sm leading-6 text-black/45">{story.summary}</p>
                    <Link href={`/explore/${story.slug}`} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#52651f]">
                      Watch it and give me direction <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link href="/explore" className="m-button m-button-ink inline-flex">
              See every feature open for input <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <section className="m-section bg-white">
        <div className="m-wrap grid gap-10 lg:grid-cols-[.9fr_1.1fr]">
          <div>
            <p className="m-eyebrow">What I need from you</p>
            <h2 className="mt-3 font-[family-name:var(--font-instrument-serif)] text-4xl leading-tight text-[#151712] md:text-5xl">
              Do not tell me only whether you like it.
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-8 text-black/52">
              The useful feedback is directional. I want to understand your workflow well enough to
              make better product choices—even when that means removing something, simplifying it,
              or changing my original idea.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {decisions.map((decision, index) => (
              <div key={decision} className="rounded-2xl border border-black/10 bg-[#faf9f5] p-5">
                <span className="text-xs font-bold text-[#667d25]">0{index + 1}</span>
                <p className="mt-3 text-lg font-semibold leading-7 text-[#151712]">{decision}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="m-section bg-[#0d0f0c] text-white">
        <div className="m-wrap grid gap-10 lg:grid-cols-[.76fr_1.24fr]">
          <div>
            <p className="m-eyebrow">The conversation is public</p>
            <h2 className="mt-3 font-[family-name:var(--font-instrument-serif)] text-4xl leading-tight md:text-5xl">
              You should be able to see whether the feedback matters.
            </h2>
            <p className="mt-5 max-w-xl leading-7 text-white/55">
              Feedback is not sent into a private black box. Suggestions remain attached to the
              feature, other musicians can vote, I can answer publicly, and I can mark an idea as
              Under review, Planned, Building or Shipped.
            </p>
            <Link href="/build-with-us" className="m-button m-button-primary mt-7 inline-flex">
              Open the community board <ArrowRight size={16} />
            </Link>
          </div>
          <CommunityPreview />
        </div>
      </section>

      <section className="m-section bg-[#ecebe4]">
        <div className="m-wrap">
          <div className="grid gap-10 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
            <div>
              <p className="m-eyebrow">What you are helping shape</p>
              <h2 className="mt-3 font-[family-name:var(--font-instrument-serif)] text-4xl leading-tight text-[#151712] md:text-5xl">
                SmartBridge connects one song across the whole production workflow.
              </h2>
              <p className="mt-5 max-w-xl text-lg leading-8 text-black/52">
                The product keeps chords, sections, key and tempo connected while you work with
                Yamaha hardware, performed MIDI, Cubase, Synthesizer V, solos, vocals and harmony.
                That is the product idea. The community input is helping determine the best way to deliver it.
              </p>
              <div className="m-actions mt-7">
                <Link href="/explore" className="m-button m-button-ink">Explore all workflows <ArrowRight size={16} /></Link>
                <a href={SITE.setupUrl} target="_blank" rel="noopener noreferrer" className="m-button m-button-quiet">
                  Get SmartBridge Desktop
                </a>
              </div>
            </div>
            <div>
              <div className="overflow-hidden rounded-[1.6rem] border border-black/10 bg-black shadow-[0_24px_70px_rgba(20,24,18,.14)]">
                <iframe
                  className="aspect-video w-full"
                  src={`https://www.youtube.com/embed/${VIDEO_LIBRARY.intro.youtubeId}?rel=0`}
                  title={VIDEO_LIBRARY.intro.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-black/38">
                <span className="inline-flex items-center gap-2"><PlayCircle size={14} /> Introduction to SmartBridge</span>
                <span>{VIDEO_LIBRARY.intro.duration}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="m-final-cta">
        <div className="m-wrap m-final-cta-inner">
          <p className="m-eyebrow">Open development</p>
          <h2>Watch a feature. Tell me what is wrong with it. Help me make SmartBridge better.</h2>
          <div className="m-actions">
            <Link href="/explore" className="m-button m-button-primary">Choose a feature to shape <ArrowRight size={17} /></Link>
            <Link href="/build-with-us" className="m-button m-button-outline-light">See what the community is asking for</Link>
          </div>
        </div>
      </section>
    </div>
  )
}
