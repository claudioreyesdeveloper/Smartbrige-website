/**
 * The band, drawn.
 *
 * WHY VECTOR AND NOT PHOTOGRAPHY
 * The reference for this screen is Yamaha's Chord Tracker, which uses a
 * licensed studio photograph. We have no equivalent imagery and none can be
 * sourced safely, so these are original figures. They also do things a photo
 * cannot: they recolour per state (playing / muted / yours), stay sharp at any
 * size, and cost a few KB each instead of a few hundred.
 *
 * Every figure is a solid shape filled with `currentColor` on one shared
 * viewBox, so the whole of a channel's state is expressed in CSS by setting a
 * text colour on the parent. No variants, no swapping assets.
 *
 * GEOMETRY IS COMPUTED, NOT HAND-WRITTEN. Limbs, guitar necks and stands are
 * all `bar()` — a quad of a given thickness between two points. The first
 * attempt used `<rect transform="rotate(a cx cy)">` with hand-guessed centres,
 * and the guitar and bass came out as indistinguishable blobs because the
 * rotation origins were wrong. Naming both endpoints is much harder to get
 * wrong, and a limb can be moved by changing a coordinate.
 *
 * BAND_FIGURES is the single seam. If real photography ever arrives, swap the
 * map's values for <Image> components and nothing else changes.
 */
import type { ComponentType, SVGProps } from "react"
import type { BandPart } from "@/lib/band-jam/engine/types"

/** Shared coordinate space. Portrait, roughly head-to-floor. */
const VIEW_BOX = "0 0 120 160"

/**
 * A straight bar of thickness `w` from (x1,y1) to (x2,y2), as a path.
 * Used for every limb, neck, stand and strap in this file.
 */
function bar(x1: number, y1: number, x2: number, y2: number, w: number): string {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy) || 1
  // Perpendicular, scaled to half the thickness.
  const px = ((dy / len) * w) / 2
  const py = ((-dx / len) * w) / 2
  return [
    `M${(x1 + px).toFixed(2)} ${(y1 + py).toFixed(2)}`,
    `L${(x2 + px).toFixed(2)} ${(y2 + py).toFixed(2)}`,
    `L${(x2 - px).toFixed(2)} ${(y2 - py).toFixed(2)}`,
    `L${(x1 - px).toFixed(2)} ${(y1 - py).toFixed(2)}`,
    "Z",
  ].join(" ")
}

type FigureProps = SVGProps<SVGSVGElement>

function Figure({ children, ...props }: FigureProps) {
  return (
    <svg
      viewBox={VIEW_BOX}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

/** Torso: shoulders tapering to the waist. */
function torso(cx: number, top: number, bottom: number, shoulder: number, waist: number) {
  return (
    `M${cx - shoulder} ${top} Q${cx} ${top - 4} ${cx + shoulder} ${top} ` +
    `L${cx + waist} ${bottom} L${cx - waist} ${bottom} Z`
  )
}

/** Singer: weight forward, mic hand up, free hand out. */
export function SingerFigure(props: FigureProps) {
  return (
    <Figure {...props}>
      <circle cx="56" cy="30" r="11" />
      <path d={torso(56, 45, 88, 12, 10)} />
      {/* mic arm, raised */}
      <path d={bar(64, 52, 84, 34, 7)} />
      {/* microphone: head and handle */}
      <circle cx="88" cy="29" r="6" />
      <path d={bar(88, 33, 95, 42, 5)} />
      {/* free arm, out and low */}
      <path d={bar(48, 52, 34, 78, 7)} />
      {/* legs */}
      <path d={bar(51, 88, 48, 140, 11)} />
      <path d={bar(61, 88, 66, 140, 11)} />
      <rect x="41" y="139" width="16" height="7" rx="3" />
      <rect x="59" y="139" width="16" height="7" rx="3" />
    </Figure>
  )
}

/** Guitarist: body at the hip, neck up to the left, strumming arm across. */
export function GuitarFigure(props: FigureProps) {
  return (
    <Figure {...props}>
      <circle cx="58" cy="26" r="11" />
      <path d={torso(58, 41, 84, 12, 10)} />
      {/* strap, shoulder to body */}
      <path d={bar(50, 44, 72, 88, 4)} opacity="0.7" />
      {/* neck and headstock, running up to the left */}
      <path d={bar(72, 96, 20, 58, 7)} />
      <path d={bar(21, 59, 10, 51, 12)} />
      {/* body */}
      <ellipse cx="78" cy="99" rx="18" ry="14" transform="rotate(-18 78 99)" />
      <circle cx="76" cy="98" r="4.5" fill="rgba(0,0,0,0.4)" />
      {/* fretting arm, out along the neck */}
      <path d={bar(48, 50, 32, 68, 7)} />
      {/* strumming arm, in over the body */}
      <path d={bar(68, 50, 80, 88, 7)} />
      {/* legs */}
      <path d={bar(53, 84, 51, 140, 11)} />
      <path d={bar(63, 84, 67, 140, 11)} />
      <rect x="44" y="139" width="16" height="7" rx="3" />
      <rect x="60" y="139" width="16" height="7" rx="3" />
    </Figure>
  )
}

/** Bassist: longer, shallower neck held low; wider stance; slimmer body. */
export function BassFigure(props: FigureProps) {
  return (
    <Figure {...props}>
      <circle cx="60" cy="26" r="11" />
      <path d={torso(60, 41, 86, 12, 10)} />
      <path d={bar(52, 44, 76, 96, 4)} opacity="0.7" />
      {/* Longer and flatter than the guitar's — this is the silhouette
          difference that tells the two apart at a glance. */}
      <path d={bar(80, 104, 8, 76, 7)} />
      <path d={bar(9, 76, 2, 73, 13)} />
      <ellipse cx="86" cy="106" rx="15" ry="12" transform="rotate(-10 86 106)" />
      <circle cx="84" cy="105" r="3.5" fill="rgba(0,0,0,0.4)" />
      {/* fretting arm reaching well down the neck */}
      <path d={bar(50, 50, 28, 74, 7)} />
      {/* plucking hand at the body */}
      <path d={bar(70, 50, 82, 96, 7)} />
      {/* wide stance */}
      <path d={bar(54, 86, 44, 140, 11)} />
      <path d={bar(66, 86, 78, 140, 11)} />
      <rect x="37" y="139" width="17" height="7" rx="3" />
      <rect x="70" y="139" width="17" height="7" rx="3" />
    </Figure>
  )
}

/** Keys: seated side-on, both hands down on the board. */
export function KeysFigure(props: FigureProps) {
  return (
    <Figure {...props}>
      <circle cx="38" cy="32" r="11" />
      <path d={torso(38, 46, 86, 11, 10)} />
      {/* thigh forward, shin down — seated */}
      <path d={bar(34, 90, 60, 90, 13)} />
      <path d={bar(34, 90, 33, 136, 12)} />
      <rect x="26" y="135" width="17" height="7" rx="3" />
      {/* stool */}
      <rect x="10" y="92" width="24" height="6" rx="3" />
      <path d={bar(15, 98, 14, 136, 5)} />
      <path d={bar(29, 98, 30, 136, 5)} />
      {/* arm forward to the keys */}
      <path d={bar(46, 54, 78, 74, 8)} />
      {/* keyboard bed, black keys, stand */}
      <rect x="58" y="76" width="56" height="10" rx="3" />
      <g fill="rgba(0,0,0,0.45)">
        <rect x="64" y="77" width="4" height="5" rx="1" />
        <rect x="72" y="77" width="4" height="5" rx="1" />
        <rect x="84" y="77" width="4" height="5" rx="1" />
        <rect x="92" y="77" width="4" height="5" rx="1" />
        <rect x="100" y="77" width="4" height="5" rx="1" />
      </g>
      <path d={bar(86, 86, 86, 138, 6)} />
      <rect x="70" y="137" width="34" height="6" rx="3" />
    </Figure>
  )
}

/** Drums: behind the kit, sticks up, kick facing us. */
export function DrumsFigure(props: FigureProps) {
  return (
    <Figure {...props}>
      {/* player, seen over the kit */}
      <circle cx="60" cy="22" r="10" />
      <path d={torso(60, 35, 68, 11, 10)} />
      {/* arms up, sticks angled out */}
      <path d={bar(52, 40, 33, 28, 7)} />
      <path d={bar(68, 40, 87, 28, 7)} />
      <path d={bar(32, 27, 16, 18, 3.5)} />
      <path d={bar(88, 27, 104, 18, 3.5)} />
      {/* cymbals on stands */}
      <path d={bar(24, 52, 24, 116, 4)} />
      <ellipse cx="24" cy="50" rx="19" ry="3.5" transform="rotate(-10 24 50)" />
      <path d={bar(97, 50, 97, 116, 4)} />
      <ellipse cx="97" cy="48" rx="17" ry="3.5" transform="rotate(10 97 48)" />
      {/* snare and its legs */}
      <rect x="26" y="88" width="26" height="12" rx="3" />
      <path d={bar(32, 100, 29, 126, 3)} />
      <path d={bar(46, 100, 49, 126, 3)} />
      {/* kick, front and centre */}
      <circle cx="66" cy="116" r="25" />
      <circle cx="66" cy="116" r="12" fill="rgba(0,0,0,0.4)" />
      {/* floor */}
      <rect x="16" y="140" width="88" height="6" rx="3" />
    </Figure>
  )
}

/**
 * Part -> figure. The one seam between the mixer and its artwork: swapping in
 * photography later means changing these values and nothing else.
 */
export const BAND_FIGURES: Record<BandPart, ComponentType<FigureProps>> = {
  drums: DrumsFigure,
  bass: BassFigure,
  guitar: GuitarFigure,
  keys: KeysFigure,
  solo: SingerFigure,
}
