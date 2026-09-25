import { VIDEO_LIBRARY } from "@/lib/site"

export type FeatureStoryGroup = "Create" | "Arrange" | "Connect"

export type FeatureStory = {
  slug: string
  title: string
  group: FeatureStoryGroup
  eyebrow: string
  summary: string
  description: string
  image: string
  video: {
    youtubeId: string
    title: string
    duration: string
  }
  steps: string[]
  capabilities: string[]
  connectedFlow: string[]
}

export const FEATURE_STORIES: FeatureStory[] = [
  {
    slug: "song-and-chords",
    title: "Song & Chords",
    group: "Create",
    eyebrow: "Jam Player",
    summary: "Define the song once so every connected SmartBridge tool works from the same sections, chords, key and tempo.",
    description: "Jam Player is the song centre: load a factory or personal chart, import ChordPro, choose key and tempo, select the Yamaha style, loop sections, record, and keep the same harmonic context available to the performance, vocal, solo and export tools.",
    image: "/images/desktop-v15/27_jam_player_song_chords.png",
    video: VIDEO_LIBRARY.jamPlayerShowcase,
    steps: ["Load or create the song", "Set key, tempo and Yamaha style", "Play or loop complete sections", "Reuse the same song context everywhere else"],
    capabilities: ["Factory and My Songs", "ChordPro import", "Section-aware chord grid", "Keyboard, SmartBridge and DAW sync", "Looping and recording", "Shared context for downstream tools"],
    connectedFlow: ["Song & Chords", "Performance / Vocal / Solo tools", "Cubase or Synthesizer V"],
  },
  {
    slug: "chord-intelligence",
    title: "Chord Intelligence",
    group: "Create",
    eyebrow: "Harmony development",
    summary: "Develop a progression with contextual suggestions and reharmonization without losing the original song structure.",
    description: "SmartBridge combines direct chord editing with circle-of-fifths choices, safe-to-colourful alternatives, harmonic ideas and genre-aware reharmonization so a progression can evolve while remaining tied to the real section.",
    image: "/images/desktop-v15/27_jam_player_song_chords.png",
    video: VIDEO_LIBRARY.chordIntelligence,
    steps: ["Select the chord or region", "Compare contextual alternatives", "Audition the musical result", "Apply only the change you want"],
    capabilities: ["Circle-of-fifths editing", "Safe and colourful suggestions", "Harmonic Ideas", "Genre-aware reharmonization", "Live audition", "Precise chord and region editing"],
    connectedFlow: ["Original progression", "Harmonic ideas", "Updated shared song context"],
  },
  {
    slug: "jam-session",
    title: "Jam Session",
    group: "Create",
    eyebrow: "Capture and structure",
    summary: "Turn ideas played on the keyboard into reusable chord and MIDI sections instead of losing them after the session.",
    description: "Jam Session records and organises song clips, imports MIDI, extracts and edits chords, arranges sections on a timeline and keeps the connected Yamaha following the result.",
    image: "/images/desktop-v15/45_jam_session_v15.png",
    video: VIDEO_LIBRARY.jamSessionChords,
    steps: ["Create a song or section", "Record or import the performance", "Edit chords and arrangement blocks", "Reuse the section in Jam Player"],
    capabilities: ["Live chord capture", "MIDI import", "Chord extraction", "Reusable clips", "Section timeline", "Keyboard-master sync"],
    connectedFlow: ["Keyboard idea", "Jam Session", "Jam Player song"],
  },
  {
    slug: "performance-library",
    title: "Performance Library",
    group: "Arrange",
    eyebrow: "Bass · drums · guitar · brass",
    summary: "Replace generic loops with played performances that are auditioned and adapted in the context of the current section.",
    description: "The performance workflow brings together bass phrases, drum grooves and fills, rhythm guitar and other played material. SmartBridge filters by musical purpose, adapts the performance to the current harmony and preserves the details that make it sound played.",
    image: "/images/desktop-v15/29_bass_performance.png",
    video: VIDEO_LIBRARY.guitarLibraries,
    steps: ["Choose the section", "Filter by musical job and feel", "Audition against the song", "Apply to SmartBridge or drag the MIDI to the DAW"],
    capabilities: ["Bass performances", "Drum grooves and matching fills", "Rhythm guitar", "Section and feel filters", "Chord adaptation", "MegaVoice-aware playback and export"],
    connectedFlow: ["Jam Player section", "Played performance", "Cubase"],
  },
  {
    slug: "solo-studio",
    title: "Solo Studio",
    group: "Arrange",
    eyebrow: "Instrumental phrasing",
    summary: "Build a solo as a musical statement with phrase form, range, energy, breathing room and in-context auditioning.",
    description: "Solo Studio selects and assembles played phrase material around the real progression, then lets you compare complete takes, control phrase form and energy, decorate the result and continue developing it in the phrase editor.",
    image: "/images/desktop-v15/37_solo_ideas.png",
    video: VIDEO_LIBRARY.soloPhrases,
    steps: ["Choose instrument and musical direction", "Generate complete phrase-based takes", "Audition with the band", "Develop or export the selected take"],
    capabilities: ["Instrument-aware ranges", "Phrase forms", "Energy arcs", "Breathing room", "Band audition", "Saved takes and DAW export"],
    connectedFlow: ["Song section", "Solo Studio", "Phrase & Riff Editor", "Cubase"],
  },
  {
    slug: "phrase-riff-editor",
    title: "Phrase & Riff Editor",
    group: "Arrange",
    eyebrow: "Performance development",
    summary: "Take a promising phrase and develop the performance with chord-aware editing, riffs, ornaments, bends and articulation.",
    description: "The piano-roll environment is now a performance workspace rather than a simple note editor. It combines harmony repair with phrase exploration, riffs, licks, ornaments, pitch-bend gestures and instrument-specific articulation while preserving the musical feel of the source.",
    image: "/images/desktop-v15/38_piano_roll_editor.png",
    video: VIDEO_LIBRARY.soloPhrases80s,
    steps: ["Open a generated or imported phrase", "Inspect it against the section harmony", "Develop riffs, ornaments and articulation", "Audition and export the finished performance"],
    capabilities: ["Chord-aware note editing", "Explore Phrase", "Riff and lick development", "Bends, trills, slides, falls and swells", "MegaVoice-aware articulation", "Band audition"],
    connectedFlow: ["Solo / imported phrase", "Phrase & Riff Editor", "Finished MIDI performance"],
  },
  {
    slug: "vocal-composer",
    title: "Vocal Composer",
    group: "Arrange",
    eyebrow: "Melody · lyrics · Synthesizer V",
    summary: "Take a song section from vocal melody idea to note-fitted lyrics and a production-ready Synthesizer V handoff.",
    description: "SmartBridge supports fast complete vocal ideas and a deeper phrase-by-phrase composer. It works from the current harmony and range, lets you develop the section shape, maps lyrics to the actual notes and moves the result into Synthesizer V.",
    image: "/images/desktop-v15/35_vocals_daw_import.png",
    video: VIDEO_LIBRARY.synthV,
    steps: ["Choose or import the vocal melody", "Develop the section phrase by phrase", "Fit lyrics to the actual notes", "Send the result to Synthesizer V"],
    capabilities: ["Complete melody suggestions", "Expert phrase builder", "Range and phrase-shape control", "Melisma-aware lyric fitting", "DAW MIDI import", "Synthesizer V handoff"],
    connectedFlow: ["Jam Player", "Vocal Composer", "Lyrics", "Synthesizer V"],
  },
  {
    slug: "harmony-orchestration",
    title: "Harmony & Orchestration",
    group: "Arrange",
    eyebrow: "Vocals · brass · strings",
    summary: "Turn one lead line into supporting vocal stacks, horn writing or string parts that follow the same song harmony.",
    description: "Separate harmony engines use the lead and current chords to build vocal, brass and string parts with practical ranges, voicing choices and humanisation, while keeping every result independently exportable.",
    image: "/images/desktop-v15/39_brass_harmonizer.png",
    video: VIDEO_LIBRARY.brassStringsSynthV,
    steps: ["Start from the lead melody", "Choose the ensemble or harmony approach", "Generate range-aware supporting parts", "Export individual voices or the full arrangement"],
    capabilities: ["Vocal stacks", "Voice profiles", "Brass voicing", "String voicing", "Range awareness", "Humanised timing and separate exports"],
    connectedFlow: ["Lead melody", "Harmony engine", "Vocal / brass / string parts"],
  },
  {
    slug: "yamaha-cubase",
    title: "Yamaha + Cubase",
    group: "Connect",
    eyebrow: "Keep the real rig organised",
    summary: "Keep Yamaha voices, channels, effects and Cubase tracks aligned instead of rebuilding the keyboard setup inside the DAW.",
    description: "SmartBridge reads and controls the actual Yamaha setup, exposes channel and effect state on one screen, saves complete mixes and keeps the matching Cubase tracks named and organised.",
    image: "/images/desktop-v15/24_genos_mixer_v15.png",
    video: VIDEO_LIBRARY.cubase,
    steps: ["Read the connected Yamaha state", "Shape voices, mix and effects", "Synchronise the matching Cubase tracks", "Save the complete setup with the song"],
    capabilities: ["32 Style and Song channels", "Voice search and selection", "DSP insertion editing", "Mix snapshots", "Ensemble presets", "Automatic Cubase track naming"],
    connectedFlow: ["Yamaha", "SmartBridge", "Cubase"],
  },
  {
    slug: "motif-style-creation",
    title: "Motif + Style Creation",
    group: "Connect",
    eyebrow: "Specialised Yamaha tools",
    summary: "Use Motif arpeggiators as editable idea material and build native Yamaha accompaniment styles from a desktop or browser workflow.",
    description: "The Motif workspace combines MULTI control, arpeggiator search, chord-following audition and recorded MIDI capture. Style Maker works from native Yamaha style structure, replaces section performances, mixes the style channels, validates the result and exports a genuine style file.",
    image: "/images/desktop-v15/46_style_maker_build.png",
    video: VIDEO_LIBRARY.tyrosMotif1,
    steps: ["Choose the Yamaha workflow", "Audition or replace the musical material", "Keep chord and performance behaviour intact", "Capture MIDI or export the native Yamaha style"],
    capabilities: ["Motif MULTI mixer", "Riff Maker and arp capture", "Chord-controlled Motif playback", "Native style sections", "Style channel mixer", ".sty / .prs export and keyboard transfer"],
    connectedFlow: ["Motif / donor style", "SmartBridge", "Editable MIDI / native Yamaha style"],
  },
]

export const FEATURE_GROUPS: FeatureStoryGroup[] = ["Create", "Arrange", "Connect"]

export function getFeatureStory(slug: string) {
  return FEATURE_STORIES.find((story) => story.slug === slug)
}
