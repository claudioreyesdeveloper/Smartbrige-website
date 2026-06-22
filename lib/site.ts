export const SITE = {
  name: "SmartBridge",
  url: "https://thesmartbridge.io",
  email: "claudio.private@gmail.com",
  setupUrl:
    "https://github.com/claudioreyesdeveloper/smartbridge-setup/releases/latest",
  docsUrl: "https://github.com/claudioreyesdeveloper/smartbridge-releases/releases/latest",
}

export const KEYBOARDS = [
  "Tyros 5",
  "Genos",
  "Genos 2",
  "PSR-SX",
  "Motif XF",
  "Motif XS",
]

export const WORKFLOW_STEPS = [
  {
    step: "01",
    title: "Pick a song or progression",
    body: "Choose a factory song (more then 600 are availabel in different styles), import a chord sheet, or build your own — every phrase you add stays tied to that harmony.",
  },
  {
    step: "02",
    title: "Layer bass, drums, guitar, brass",
    body: "Audition phrases for each section of the chart. Hear bass, drums, rhythm guitar, and horns that follow your chords before you drag to you DAW.",
  },
  {
    step: "03",
    title: "Sketch solos and vocals",
    body: "Generate solo ideas, backing harmonies, and lead vocal phrases — all against the same progression and tempo you’re already working in.",
  },
  {
    step: "04",
    title: "Create lyrics",
    body: "Use the AI driven lyrics generator to create lyrics for you midi melody. and the text is adapted to you melody.",
  },
  {
    step: "05",
    title: "Export or keep jamming",
    body: "Drag parts into Cubase, send melodies to Synthesizer V, or record new chord clips in Jam Session and loop them on the keyboard.",
  },
]

export const PILLARS = [
  {
    id: "arrange",
    title: "Your chords are the anchor",
    summary: "Everything listens to the progression you’re playing.",
    body:
      "Bass lines, drum grooves, guitar strums, brass, solos, and vocals are chosen or generated for the section you’re in — Intro, Verse, Chorus — not dropped on top of a generic loop.",
  },
  {
    id: "keyboard",
    title: "Mix and sound from the computer",
    summary: "See the whole keyboard mix without menu diving.",
    body:
      "Adjust levels, pan, chorus, reverb, and DSP per part from one screen. Save and recall mixes for different songs or gigs.",
  },
  {
    id: "generate",
    title: "Phrases, not random MIDI files",
    summary: "Browse and generate parts that fit the chart.",
    body:
      "Thousands of bass, drum, guitar, brass, and vocal clips — plus generated rhythm guitar and brass when you want a fresh take. Play, compare, then drag the winner into your DAW.",
  },
  {
    id: "produce",
    title: "Vocals and solos to production",
    summary: "Harmonies, lyrics, SynthV, and Cubase in one flow.",
    body:
      "Stack backing vocals, import a melody from the DAW, generate lyric ideas, harmonize a solo line with brass or strings, and send the result to Synthesizer V or Cubase without rebuilding the song from scratch.",
  },
]

export type FeatureModule = {
  id: string
  name: string
  tag: string
  image: string
  what: string
  why: string
}

/** Musician-facing feature list — each image matches a current SmartBridge 1.0 screen. */
export const FEATURE_MODULES: FeatureModule[] = [
  {
    id: "genos-mixer",
    name: "Genos Mixer",
    tag: "Control your keyboard",
    image: "/images/genos-mixer.png",
    what:
      "A full mixing desk on your computer for Style and Song parts — volume, pan, chorus, reverb, bass, and treble for every channel, plus voice search and FX on/off per part.",
    why:
      "You can balance a gig or a recording take faster than scrolling one channel at a time on the Genos screen, and save or load the whole mix when you switch songs.",
  },
  {
    id: "dsp-effects",
    name: "DSP Effects",
    tag: "Control your keyboard",
    image: "/images/genos-dsp-effects.png",
    what:
      "See all insertion DSP slots at once — which effect is on RIGHT1, LEFT, Multi Pads, and which algorithm (delay, chorus, presence, etc.) is assigned to each slot.",
    why:
      "When a part sounds wrong, you find the effect chain in seconds instead of hunting through nested keyboard menus.",
  },
  {
    id: "ensemble",
    name: "Ensemble presets",
    tag: "Control your keyboard",
    image: "/images/genos-ensemble.png",
    what:
      "Pick a brass ensemble recipe — Pop Brass, Big Band, Ballad Horns, Orchestral Brass — and see exactly which trumpet and horn voices land on each ensemble part before you apply.",
    why:
      "You get a commercial brass section layout in one click, mapped to the right Genos ensemble voices for your song channel.",
  },
  {
    id: "jam-player",
    name: "Jam Player",
    tag: "Play & arrange",
    image: "/images/jam-player-tyros.png",
    what:
      "Load a factory or My Songs chart, see every chord in Intro and Verse on a grid, sync tempo and key with the keyboard, and pick the Latin style (or any category) that follows your chords.",
    why:
      "This is the home screen for writing: you hear the progression, the keyboard style follows, and every other tool (bass, drums, vocals) knows which section you’re in.",
  },
  {
    id: "jam-session",
    name: "Jam Session",
    tag: "Play & arrange",
    image: "/images/jam-session.png",
    what:
      "Record chord clips from the keyboard on a timeline, see the detected chord stream bar by bar, loop sections, and save clips with both chord and MIDI data ready.",
    why:
      "When you’re improvising on the Genos, you capture what you actually played — chords and performance — and turn it into reusable clips instead of losing the idea.",
  },
  {
    id: "bass-library",
    name: "Bass phrase library",
    tag: "Layer the arrangement",
    image: "/images/bass-library.png",
    what:
      "Browse bass clips filtered by genre, section type, and feel. Audition an Intro bass line matched to your tempo, then drag it to Cubase or apply it to the section.",
    why:
      "You hear bass parts that fit the chart before you search bass folders or write from scratch — and the match reason tells you why a clip was suggested.",
  },
  {
    id: "drum-library",
    name: "Drum grooves & fills",
    tag: "Layer the arrangement",
    image: "/images/drum-library.png",
    what:
      "Pick a drum groove for the section, browse suggested fills for bar 4 and bar 8, and audition cinematic, pop, or fusion kits aligned with your tempo.",
    why:
      "The groove and fills belong to the same song section — you’re not guessing which loop will sit right on your chords.",
  },
  {
    id: "rhythm-guitar",
    name: "Rhythm guitar",
    tag: "Layer the arrangement",
    image: "/images/rhythm-guitar.png",
    what:
      "Generate strummed rhythm guitar for a section — choose voicing, velocity, and feel — then play takes, regenerate, or drag the chosen performance to Cubase.",
    why:
      "You get a guitarist’s part that follows your chord changes and strum pattern without programming MIDI note by note.",
  },
  {
    id: "brass-performance",
    name: "Brass phrases",
    tag: "Layer the arrangement",
    image: "/images/brass-performance.png",
    what:
      "Audition library brass phrases or generate a new performance for Intro, Verse, or Chorus — with voicing, humanize, and apply-to-section controls.",
    why:
      "Horn lines land in the right register and length for the section; you compare takes and apply the one that fits the arrangement.",
  },
  {
    id: "vocal-generator",
    name: "Vocal phrase generator",
    tag: "Vocals & lyrics",
    image: "/images/vocal-generator.png",
    what:
      "Generate lead vocal melody ideas from a large phrase library — filtered by musical context, range, and phrase shape for the current section and BPM.",
    why:
      "You start with singable lines that already respect your key and section length instead of drawing notes on a blank piano roll.",
  },
  {
    id: "vocal-harmonizer",
    name: "Vocal harmonizer",
    tag: "Vocals & lyrics",
    image: "/images/vocal-harmonizer.png",
    what:
      "Stack backing vocals behind a lead — Pop Stack, scale-based voicings, humanized timing — then drag Lead, Harmony 1, 2, and 3 as separate MIDI into Cubase.",
    why:
      "You hear a full vocal arrangement (lead plus harmonies) before you open the DAW, and export each part on its own track.",
  },
  {
    id: "vocal-synthv",
    name: "Lyrics & Synthesizer V",
    tag: "Vocals & lyrics",
    image: "/images/vocal-synthv-import.png",
    what:
      "Drop a melody MIDI from the DAW, set a hook phrase and lyric mode, generate lyric text, then send the melody to Synthesizer V at the playhead — chords can follow too.",
    why:
      "Your vocal sketch moves from Cubase into SynthV for production without copying MIDI by hand, and lyrics stay tied to the melody you imported.",
  },
  {
    id: "solo-generator",
    name: "Instrumental solo ideas",
    tag: "Solos & harmonization",
    image: "/images/solo-generator.png",
    what:
      "Get opening solo lines suggested by style, feel, groove, and energy — read why each phrase works (“lands chord tones”, “sustained line”), then play, save, or drag to Cubase.",
    why:
      "When you need a lead for the solo break, you audition musical openings that fit the ballad or funk feel you’re in — not a generic lick library.",
  },
  {
    id: "solo-brass-harmonizer",
    name: "Brass behind the solo",
    tag: "Solos & harmonization",
    image: "/images/solo-brass-harmonizer.png",
    what:
      "Drop a solo MIDI line and harmonize it with close-position brass voicings that follow the chord chart — including extensions and slash chords.",
    why:
      "Your single-note solo becomes a sectional brass answer without manually voicing four horn parts.",
  },
  {
    id: "solo-strings-harmonizer",
    name: "Strings behind the solo",
    tag: "Solos & harmonization",
    image: "/images/solo-strings-harmonizer.png",
    what:
      "Add a light string pad or violin support under a melody using presets like Strings Lite — thin support on structural notes so the lead stays exposed.",
    why:
      "You get orchestral color under a solo or vocal without a busy string part fighting the melody.",
  },
]

export const GALLERY = [
  {
    src: "/images/jam-player-tyros.png",
    caption: "Jam Player — chord grid, factory songs, and style sync with the keyboard",
  },
  {
    src: "/images/bass-library.png",
    caption: "Bass library — section-matched phrases with drag-to-Cubase",
  },
  {
    src: "/images/vocal-harmonizer.png",
    caption: "Vocal harmonizer — lead plus three harmony parts ready for export",
  },
  {
    src: "/images/jam-session.png",
    caption: "Jam Session — record chord clips and see them on a timeline",
  },
]

export const COMPAT = {
  platforms: ["macOS (Apple Silicon)", "Windows 10/11 (x64)"],
  formats: ["VST3", "Standalone"],
  daws: ["Cubase (MIDI Remote + template)", "Reaper", "Studio One", "Ableton Live", "FL Studio"],
  integrations: ["Synthesizer V side panel", "loopMIDI / virtual MIDI", "Yamaha USB MIDI"],
}
