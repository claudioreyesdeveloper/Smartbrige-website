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

export type DemoVideo = {
  title: string
  url: string
  note?: string
}

const youtubeVideo = (id: string, title: string, note?: string): DemoVideo => ({
  title,
  url: `https://www.youtube.com/watch?v=${id}`,
  ...(note ? { note } : {}),
})

export const VIDEO_LIBRARY = {
  intro: youtubeVideo("rLeI2Q81RZY", "Introduction to SmartBridge"),
  jamPlayerTyros: youtubeVideo("0avkl3oOfDc", "Jamplayer Tyros Edition"),
  jamPlayerShowcase: youtubeVideo("5roDpI7T7l4", "Jamplayer Showcase"),
  chordIntelligence: youtubeVideo("DKaAJCsqXf8", "SmartBridge becomes chord intelligent"),
  reharmonization: youtubeVideo("vtmZF9fsm8s", "New Reharmonization and MIDI Features in Jam Player"),
  chordDatabase: youtubeVideo("91dTEKuc8LE", "SmartBridge and the database of chordprogressions"),
  jamSessionChords: youtubeVideo("yU3bXdf_Jk8", "Using Jamsession to create you own chord progressions"),
  chordPro: youtubeVideo("aKD-5q6FQWQ", "Smarbridge and Chordpro"),
  guitarLibraries: youtubeVideo("hnV7lnrGVPY", "SmartBridge and the guitar libraries"),
  superGroove: youtubeVideo("iH_3ZFzr1ik", "SuperGroove re designed with Smartbridge"),
  cinematicPercussion: youtubeVideo("XAHaz5ASlOk", "Cinematic Percussion in Smartbridge"),
  cubase: youtubeVideo("gFQmxucBSio", "Smartbridge Cubase integrations"),
  synthV: youtubeVideo("azqq3VBnTQw", "SmartBridge and Syntesizer V integration"),
  rockSong: youtubeVideo("4pg6iBNCIng", "Creating Rocksong with Smartbridge and Synthesizer V"),
  vocalAndSolo: youtubeVideo("spvlH81uyi4", "New Vocal Generator & Solo Phrases Update"),
  brassStringsSynthV: youtubeVideo(
    "LN3JklYfcrY",
    "New Music Production Features  Brass, Strings & Synthesizer V Integration",
  ),
  soloPhrases: youtubeVideo("UNBGDCi8-Cc", "New Solo Phrase Feature for Music Composition"),
  soloPhrases80s: youtubeVideo("1cJNGaID7h8", "Tella Solo Phrases  80s Power Rock & Pop Rock"),
  popHorns: youtubeVideo("2JzTwx45PR4", "Pop Horns Showcase"),
  lyricsRock: youtubeVideo("-GMGe_C6Zbk", "Show-casing Lyrics with a typica Rock Song"),
  lyricsBarryImproved: youtubeVideo("UQg8YyiZEn8", "Lyrics feature improved with Barry White"),
  lyricsBarrySong: youtubeVideo("Qw2qZm51LhM", "Barry White song using the new lyrics feature"),
  finishedSong: youtubeVideo("1zKXAAAZrmc", "Finished song using Smartbridge and Syntesizer V"),
  firstVersion: youtubeVideo("RkSi3RGmAYQ", "Smartbridge 1 0. the first version packed with new features"),
  tyrosMotif1: youtubeVideo("QCEmvHhyT58", "Creating a song using motif and tyros part 1"),
  tyrosMotif2: youtubeVideo("yaPydsXYpVM", "Creating a Song using Tyros and Motif Part 2"),
  lennySong: youtubeVideo("QiQ5DqTEMv4", "Creating a Lenny K type of Song"),
  ballad: youtubeVideo("tuTRgiZ3j0I", "Creating a Ballad in 10 min"),
  sysex: youtubeVideo("3NDS378JnJ4", "SmartBrige instead of Sysex Messages"),
  tyrosMixer: youtubeVideo("arHZdbS_Qig", "SmartBrige using the Tyros Mixer"),
}

export type FeatureModule = {
  id: string
  name: string
  tag: string
  image: string
  what: string
  why: string
  highlights: string[]
  videos: DemoVideo[]
}

/** Musician-facing feature list — each image matches a current SmartBridge screen or workflow. */
export const FEATURE_MODULES: FeatureModule[] = [
  {
    id: "genos-mixer",
    name: "Genos Mixer",
    tag: "Control your keyboard",
    image: "/images/genos-mixer.png",
    what:
      "A full mixing desk on your computer for Style and Song parts — volume, pan, chorus, reverb, bass, treble, voice search, and FX routing for every channel from one screen.",
    why:
      "You can balance a gig or a production session faster than scrolling one channel at a time on the keyboard, then save or reload the whole mix when you switch songs.",
    highlights: [
      "See multiple keyboard channels at once instead of menu-diving on hardware.",
      "Adjust mix, EQ-style tone controls, and FX state while the song chart stays visible.",
      "Fits both Genos-style live setups and Cubase-oriented production sessions.",
    ],
    videos: [VIDEO_LIBRARY.tyrosMixer, VIDEO_LIBRARY.cubase, VIDEO_LIBRARY.firstVersion],
  },
  {
    id: "dsp-effects",
    name: "DSP Effects",
    tag: "Control your keyboard",
    image: "/images/genos-dsp-effects.png",
    what:
      "See all insertion DSP slots at once — which effect is on RIGHT1, LEFT, Multi Pads, and which algorithm (delay, chorus, presence, and more) is assigned to each slot.",
    why:
      "When a part sounds wrong, you find the effect chain in seconds instead of hunting through nested keyboard menus.",
    highlights: [
      "One-screen visibility over effect assignments that are usually spread across multiple hardware pages.",
      "Faster troubleshooting when a patch sounds too wet, too bright, or simply wrong for the song.",
      "Works as part of the same computer-first control workflow as the mixer and channel tools.",
    ],
    videos: [VIDEO_LIBRARY.tyrosMixer, VIDEO_LIBRARY.sysex, VIDEO_LIBRARY.firstVersion],
  },
  {
    id: "ensemble",
    name: "Ensemble presets",
    tag: "Control your keyboard",
    image: "/images/genos-ensemble.png",
    what:
      "Pick a brass ensemble recipe — Pop Brass, Big Band, Ballad Horns, Orchestral Brass — and see exactly which trumpet and horn voices land on each ensemble part before you apply it.",
    why:
      "You get a commercial brass section layout in one click, mapped to the right Genos ensemble voices for your song channel.",
    highlights: [
      "Preview ensemble voicing before applying it to the keyboard.",
      "Choose section colors that match ballads, pop horns, orchestral brass, or bigger band arrangements.",
      "Useful when building horn stacks around generated phrases or solo harmonizations.",
    ],
    videos: [VIDEO_LIBRARY.popHorns, VIDEO_LIBRARY.brassStringsSynthV, VIDEO_LIBRARY.firstVersion],
  },
  {
    id: "jam-player",
    name: "Jam Player",
    tag: "Play & arrange",
    image: "/images/jam-player-tyros.png",
    what:
      "Load a factory or My Songs chart, see every chord in Intro, Verse, and Chorus on a grid, sync tempo and key with the keyboard, and audition styles or phrase libraries against the same progression.",
    why:
      "This is the songwriting hub: you hear the progression, the keyboard follows it, and every other tool — bass, drums, guitars, vocals, lyrics, and solos — knows which section you’re in.",
    highlights: [
      "Start from curated songs, your own progressions, or imported charts.",
      "Reharmonize existing progressions without losing the original structure of the song.",
      "Acts as the shared musical context for phrase suggestions, vocals, and export workflows.",
    ],
    videos: [
      VIDEO_LIBRARY.intro,
      VIDEO_LIBRARY.jamPlayerTyros,
      VIDEO_LIBRARY.jamPlayerShowcase,
      VIDEO_LIBRARY.chordIntelligence,
      VIDEO_LIBRARY.reharmonization,
      VIDEO_LIBRARY.chordDatabase,
    ],
  },
  {
    id: "jam-session",
    name: "Jam Session",
    tag: "Play & arrange",
    image: "/images/jam-session.png",
    what:
      "Record chord clips from the keyboard on a timeline, see the detected chord stream bar by bar, loop sections, and save clips with both chord and MIDI data ready for later use.",
    why:
      "When you improvise on the keyboard, you capture what you actually played — chords and timing — and turn it into reusable clips instead of losing the idea.",
    highlights: [
      "Turns live keyboard exploration into editable chord clips.",
      "Keeps chord data and MIDI performance together for later arrangement work.",
      "Gives you a custom starting point when factory songs are not the right fit.",
    ],
    videos: [VIDEO_LIBRARY.jamSessionChords, VIDEO_LIBRARY.tyrosMotif1, VIDEO_LIBRARY.tyrosMotif2],
  },
  {
    id: "chordpro-import",
    name: "ChordPro import",
    tag: "Play & arrange",
    image: "/images/import-chord-sheet.png",
    what:
      "Import ChordPro chord sheets with embedded lyrics, chords, and section instructions so a plain text song chart becomes a playable SmartBridge arrangement source.",
    why:
      "You can move from a text chart to a structured song workflow without manually retyping chords or rebuilding the form bar by bar.",
    highlights: [
      "Reads chords, lyric placement, and section instructions from a common text-song format.",
      "Great for bringing existing catalog songs into Jam Player quickly.",
      "Bridges songwriter text charts and arranger-keyboard production workflows.",
    ],
    videos: [VIDEO_LIBRARY.chordPro, VIDEO_LIBRARY.chordIntelligence],
  },
  {
    id: "bass-library",
    name: "Bass phrase library",
    tag: "Layer the arrangement",
    image: "/images/bass-library.png",
    what:
      "Browse bass clips filtered by genre, section type, and feel. Audition an Intro bass line matched to your tempo, then drag it to Cubase or apply it to the section.",
    why:
      "You hear bass parts that fit the chart before you search folders or program notes from scratch — and the match reason tells you why a clip was suggested.",
    highlights: [
      "Section-aware suggestions keep intros, verses, and choruses feeling different.",
      "Works with SmartBridge’s chord grid instead of disconnected MIDI folders.",
      "Pairs naturally with the drums and guitar libraries for rapid arrangement sketches.",
    ],
    videos: [VIDEO_LIBRARY.reharmonization, VIDEO_LIBRARY.ballad, VIDEO_LIBRARY.rockSong],
  },
  {
    id: "drum-library",
    name: "Drum grooves & fills",
    tag: "Layer the arrangement",
    image: "/images/drum-library.png",
    what:
      "Pick a drum groove for the section, browse suggested fills for bar 4 and bar 8, and audition cinematic, pop, rock, or fusion kits aligned with your tempo.",
    why:
      "The groove and fills belong to the same song section — you’re not guessing which loop will sit right on your chords.",
    highlights: [
      "Pairs grooves and fills so the part feels arranged, not pasted together.",
      "Lets you expand beyond style-engine repetition with phrase-level drum choices.",
      "Useful for cinematic scoring as well as rock and pop demos.",
    ],
    videos: [VIDEO_LIBRARY.reharmonization, VIDEO_LIBRARY.cinematicPercussion, VIDEO_LIBRARY.finishedSong],
  },
  {
    id: "rhythm-guitar",
    name: "Rhythm guitar",
    tag: "Layer the arrangement",
    image: "/images/rhythm-guitar.png",
    what:
      "Generate or browse chord-aware rhythm guitar parts for a section — choose voicing, velocity, and feel — then play takes, regenerate, or drag the chosen performance to Cubase.",
    why:
      "You get a guitarist’s part that follows your chord changes and strum pattern without programming MIDI note by note.",
    highlights: [
      "Built to replace repetitive style-engine strums with more musical guitar clips.",
      "Works for pop, funk, disco, and rock arrangements tied to the current progression.",
      "Useful as either an audition tool or a direct drag-to-DAW production source.",
    ],
    videos: [VIDEO_LIBRARY.guitarLibraries, VIDEO_LIBRARY.superGroove, VIDEO_LIBRARY.rockSong],
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
    highlights: [
      "Built for hooks, accents, stabs, and section lifts rather than generic brass pads.",
      "Lets you compare phrase takes before committing to the arrangement.",
      "Fits well with the pop-horns and ensemble workflows shown in Claudio’s demos.",
    ],
    videos: [VIDEO_LIBRARY.popHorns, VIDEO_LIBRARY.brassStringsSynthV, VIDEO_LIBRARY.rockSong],
  },
  {
    id: "vocal-generator",
    name: "Vocal phrase generator",
    tag: "Vocals & lyrics",
    image: "/images/vocal-generator.png",
    what:
      "Generate lead vocal melody ideas from a large phrase library — filtered by musical context, range, style, and phrase shape for the current section and BPM.",
    why:
      "You start with singable lines that already respect your key and section length instead of drawing notes on a blank piano roll.",
    highlights: [
      "Phrase libraries are organized by style so the starting idea already feels musical.",
      "Great for getting a topline moving before lyrics are written.",
      "Shares the same chord and section context as the rest of the arrangement tools.",
    ],
    videos: [VIDEO_LIBRARY.vocalAndSolo, VIDEO_LIBRARY.brassStringsSynthV],
  },
  {
    id: "vocal-harmonizer",
    name: "Vocal harmonizer",
    tag: "Vocals & lyrics",
    image: "/images/vocal-harmonizer.png",
    what:
      "Stack backing vocals behind a lead — pop stacks, scale-based voicings, and humanized timing — then drag Lead, Harmony 1, 2, and 3 as separate MIDI tracks into Cubase.",
    why:
      "You hear a full vocal arrangement before opening the DAW, and export each part separately when the stack is ready.",
    highlights: [
      "Designed for production-ready backing vocals, not just theory exercises.",
      "Creates multiple harmony lines quickly from the same song context.",
      "Useful on its own or as part of the Synthesizer V workflow.",
    ],
    videos: [VIDEO_LIBRARY.brassStringsSynthV, VIDEO_LIBRARY.rockSong, VIDEO_LIBRARY.finishedSong],
  },
  {
    id: "vocal-synthv",
    name: "Lyrics & Synthesizer V",
    tag: "Vocals & lyrics",
    image: "/images/vocal-synthv-import.png",
    what:
      "Drop a melody MIDI from the DAW, set a hook phrase and lyric mode, generate lyric text, then send the melody to Synthesizer V at the playhead — with chords following when needed.",
    why:
      "Your vocal sketch moves from Cubase into SynthV for production without copying MIDI by hand, and the lyric workflow stays tied to the melody you imported.",
    highlights: [
      "Supports melody import, lyric generation, and fast handoff into Synthesizer V.",
      "Useful for both demo vocals and more detailed production passes.",
      "Shown repeatedly in Claudio’s rock-song, Barry White, and integration walkthroughs.",
    ],
    videos: [
      VIDEO_LIBRARY.synthV,
      VIDEO_LIBRARY.rockSong,
      VIDEO_LIBRARY.lyricsRock,
      VIDEO_LIBRARY.lyricsBarryImproved,
      VIDEO_LIBRARY.lyricsBarrySong,
      VIDEO_LIBRARY.finishedSong,
    ],
  },
  {
    id: "solo-generator",
    name: "Instrumental solo ideas",
    tag: "Solos & harmonization",
    image: "/images/solo-generator.png",
    what:
      "Get opening solo lines suggested by style, feel, groove, and energy — read why each phrase works, then play, save, or drag the idea into Cubase.",
    why:
      "When you need a lead for the solo break, you audition musical openings that fit the ballad, funk, or rock feel you’re in — not a generic lick library.",
    highlights: [
      "Built to get you unstuck at the composition stage fast.",
      "Phrases are organized by style and energy so results feel targeted.",
      "Pairs naturally with brass or string harmonization for bigger lead moments.",
    ],
    videos: [VIDEO_LIBRARY.soloPhrases, VIDEO_LIBRARY.soloPhrases80s, VIDEO_LIBRARY.vocalAndSolo],
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
    highlights: [
      "Turns lead lines into arranged horn responses quickly.",
      "Keeps voicings tied to the current progression instead of static intervals.",
      "Useful for pop, funk, R&B, and cinematic brass textures.",
    ],
    videos: [VIDEO_LIBRARY.brassStringsSynthV, VIDEO_LIBRARY.popHorns],
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
    highlights: [
      "Designed for supportive string writing rather than dense orchestration.",
      "Lets a melody stay forward while still gaining cinematic weight.",
      "Part of the same harmonization engine used for brass and backing vocals.",
    ],
    videos: [VIDEO_LIBRARY.brassStringsSynthV, VIDEO_LIBRARY.cinematicPercussion],
  },
]

export type ProductVideoGuide = {
  title: string
  summary: string
  video: DemoVideo
  featureIds: string[]
}

export const PRODUCT_VIDEO_GUIDES: ProductVideoGuide[] = [
  {
    title: "Introduction to SmartBridge",
    summary: "A top-level introduction to the product and the keyboard-to-production workflow it is trying to solve.",
    video: VIDEO_LIBRARY.intro,
    featureIds: ["jam-player", "jam-session", "genos-mixer"],
  },
  {
    title: "Jamplayer Tyros Edition",
    summary: "Shows Jam Player as a songwriting front end tailored to Tyros users.",
    video: VIDEO_LIBRARY.jamPlayerTyros,
    featureIds: ["jam-player"],
  },
  {
    title: "Jamplayer Showcase",
    summary: "A progression-focused showcase of how Jam Player helps you start songs quickly from interesting chord movement.",
    video: VIDEO_LIBRARY.jamPlayerShowcase,
    featureIds: ["jam-player"],
  },
  {
    title: "SmartBridge becomes chord intelligent",
    summary: "Focuses on Jam Player chord intelligence and reharmonization ideas while preserving original song color.",
    video: VIDEO_LIBRARY.chordIntelligence,
    featureIds: ["jam-player", "chordpro-import"],
  },
  {
    title: "New Reharmonization and MIDI Features in Jam Player",
    summary: "Adds a clearer reharmonization story plus expanded drum and bass MIDI material for arrangement building.",
    video: VIDEO_LIBRARY.reharmonization,
    featureIds: ["jam-player", "bass-library", "drum-library"],
  },
  {
    title: "SmartBridge and the database of chordprogressions",
    summary: "Explains how a chord progression database helps you begin songs faster from stronger harmonic starting points.",
    video: VIDEO_LIBRARY.chordDatabase,
    featureIds: ["jam-player"],
  },
  {
    title: "Using Jamsession to create you own chord progressions",
    summary: "Dedicated Jam Session walkthrough for recording and reusing your own progressions instead of only relying on factory material.",
    video: VIDEO_LIBRARY.jamSessionChords,
    featureIds: ["jam-session"],
  },
  {
    title: "Smarbridge and Chordpro",
    summary: "Shows SmartBridge importing ChordPro charts with chords, lyrics, and instructions from a plain text song file.",
    video: VIDEO_LIBRARY.chordPro,
    featureIds: ["chordpro-import", "jam-player"],
  },
  {
    title: "SmartBridge and the guitar libraries",
    summary: "Explains why SmartBridge’s guitar clips exist and how they replace repetitive arranger-style strumming with more musical chord-aware parts.",
    video: VIDEO_LIBRARY.guitarLibraries,
    featureIds: ["rhythm-guitar"],
  },
  {
    title: "SuperGroove re designed with Smartbridge",
    summary: "A style-and-clips demo showing how SmartBridge can reshape groove and harmony for funk and R&B writing.",
    video: VIDEO_LIBRARY.superGroove,
    featureIds: ["rhythm-guitar", "brass-performance", "jam-player"],
  },
  {
    title: "Cinematic Percussion in Smartbridge",
    summary: "Introduces a scoring-oriented angle with cinematic songs, percussion choices, and soundtrack-flavored arrangement ideas.",
    video: VIDEO_LIBRARY.cinematicPercussion,
    featureIds: ["drum-library", "solo-strings-harmonizer"],
  },
  {
    title: "Smartbridge Cubase integrations",
    summary: "Shows the computer-first production workflow, including multi-channel keyboard control and Cubase-oriented setup.",
    video: VIDEO_LIBRARY.cubase,
    featureIds: ["genos-mixer", "vocal-synthv"],
  },
  {
    title: "SmartBridge and Syntesizer V integration",
    summary: "Demonstrates SmartBridge sending melody context into Synthesizer V so vocal production stays tied to the arrangement.",
    video: VIDEO_LIBRARY.synthV,
    featureIds: ["vocal-synthv", "vocal-harmonizer"],
  },
  {
    title: "Creating Rocksong with Smartbridge and Synthesizer V",
    summary: "An end-to-end rock-song build showing templates, phrase layers, lyrics, and Synthesizer V in one writing session.",
    video: VIDEO_LIBRARY.rockSong,
    featureIds: ["vocal-synthv", "vocal-harmonizer", "rhythm-guitar", "brass-performance"],
  },
  {
    title: "New Vocal Generator & Solo Phrases Update",
    summary: "Introduces new phrase libraries for vocal toplines and instrumental solos inside the SmartBridge workflow.",
    video: VIDEO_LIBRARY.vocalAndSolo,
    featureIds: ["vocal-generator", "solo-generator"],
  },
  {
    title: "New Music Production Features  Brass, Strings & Synthesizer V Integration",
    summary: "Teases the broader harmonization engine: backing vocals, brass, strings, and Synthesizer V round-tripping.",
    video: VIDEO_LIBRARY.brassStringsSynthV,
    featureIds: ["vocal-harmonizer", "solo-brass-harmonizer", "solo-strings-harmonizer", "vocal-synthv"],
  },
  {
    title: "New Solo Phrase Feature for Music Composition",
    summary: "Shows the smarter solo phrase engine as a quick way to get melodic ideas at the start of composition.",
    video: VIDEO_LIBRARY.soloPhrases,
    featureIds: ["solo-generator"],
  },
  {
    title: "Tella Solo Phrases 80s Power Rock & Pop Rock",
    summary: "A style-specific solo-phrase showcase focused on 80s power rock and pop-rock leads.",
    video: VIDEO_LIBRARY.soloPhrases80s,
    featureIds: ["solo-generator"],
  },
  {
    title: "Pop Horns Showcase",
    summary: "A focused demo of the pop-horns phrase approach for stabby accents and section lifts.",
    video: VIDEO_LIBRARY.popHorns,
    featureIds: ["brass-performance", "ensemble", "solo-brass-harmonizer"],
  },
  {
    title: "Show-casing Lyrics with a typica Rock Song",
    summary: "A rock-focused lyrics walkthrough where generated text is used as part of a fuller production idea.",
    video: VIDEO_LIBRARY.lyricsRock,
    featureIds: ["vocal-synthv"],
  },
  {
    title: "Lyrics feature improved with Barry White",
    summary: "Shows a newer pass of the lyrics workflow using a Barry White-style reference arrangement.",
    video: VIDEO_LIBRARY.lyricsBarryImproved,
    featureIds: ["vocal-synthv"],
  },
  {
    title: "Barry White song using the new lyrics feature",
    summary: "A finished example built around the newer lyrics system rather than just a feature tour.",
    video: VIDEO_LIBRARY.lyricsBarrySong,
    featureIds: ["vocal-synthv"],
  },
  {
    title: "Finished song using Smartbridge and Syntesizer V",
    summary: "Shows how the SmartBridge arrangement work and Synthesizer V workflow come together in a finished rock production.",
    video: VIDEO_LIBRARY.finishedSong,
    featureIds: ["vocal-synthv", "vocal-harmonizer", "drum-library"],
  },
  {
    title: "Smartbridge 1 0. the first version packed with new features",
    summary: "A broad 1.0-era tour covering the refreshed interface and the growing production workflow around the app.",
    video: VIDEO_LIBRARY.firstVersion,
    featureIds: ["genos-mixer", "jam-player", "vocal-synthv"],
  },
  {
    title: "Creating a song using motif and tyros part 1",
    summary: "Part one of a Tyros and Motif songwriting build inside the SmartBridge environment.",
    video: VIDEO_LIBRARY.tyrosMotif1,
    featureIds: ["jam-session", "jam-player"],
  },
  {
    title: "Creating a Song using Tyros and Motif Part 2",
    summary: "Part two of the same Tyros and Motif songwriting workflow, continuing the arrangement build.",
    video: VIDEO_LIBRARY.tyrosMotif2,
    featureIds: ["jam-session", "jam-player"],
  },
  {
    title: "Creating a Lenny K type of Song",
    summary: "A style-led songwriting demo showing how SmartBridge modules can be used to shape a full track concept quickly.",
    video: VIDEO_LIBRARY.lennySong,
    featureIds: ["jam-player", "vocal-synthv", "rhythm-guitar"],
  },
  {
    title: "Creating a Ballad in 10 min",
    summary: "A rapid creation demo showing how quickly the arrangement workflow can get a ballad off the ground.",
    video: VIDEO_LIBRARY.ballad,
    featureIds: ["jam-player", "bass-library", "drum-library"],
  },
  {
    title: "SmartBrige instead of Sysex Messages",
    summary: "A control-workflow argument for using SmartBridge’s interface instead of traditional sysex-heavy keyboard editing.",
    video: VIDEO_LIBRARY.sysex,
    featureIds: ["genos-mixer", "dsp-effects"],
  },
  {
    title: "SmartBrige using the Tyros Mixer",
    summary: "A dedicated mixer-centric demo for Tyros users who want more direct control from the computer.",
    video: VIDEO_LIBRARY.tyrosMixer,
    featureIds: ["genos-mixer", "dsp-effects"],
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
