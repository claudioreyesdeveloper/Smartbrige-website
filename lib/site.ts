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
    body: "Choose a factory song (more than 600 are available in different styles), import a chord sheet, or build your own — every phrase you add stays tied to that harmony.",
  },
  {
    step: "02",
    title: "Layer bass, drums, guitar, brass",
    body: "Audition phrases for each section of the chart. Hear bass, drums, rhythm guitar, and horns that follow your chords before you drag them to your DAW.",
  },
  {
    step: "03",
    title: "Sketch solos and vocals",
    body: "Generate solo ideas, backing harmonies, and lead vocal phrases — all against the same progression and tempo you’re already working in.",
  },
  {
    step: "04",
    title: "Create lyrics",
    body: "Use the AI-driven lyrics generator to write lyrics for your MIDI melody — text shaped to fit the notes you already have.",
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
  youtubeId: string
  duration: string
  note?: string
}

const youtubeVideo = (id: string, title: string, duration: string, note?: string): DemoVideo => ({
  title,
  url: `https://www.youtube.com/watch?v=${id}`,
  youtubeId: id,
  duration,
  ...(note ? { note } : {}),
})

export const VIDEO_LIBRARY = {
  intro: youtubeVideo("rLeI2Q81RZY", "Introduction to SmartBridge", "1:58"),
  jamPlayerTyros: youtubeVideo("0avkl3oOfDc", "Jam Player: Tyros Edition", "2:52"),
  jamPlayerShowcase: youtubeVideo("5roDpI7T7l4", "Jam Player Showcase", "11:07"),
  chordIntelligence: youtubeVideo("DKaAJCsqXf8", "SmartBridge Becomes Chord-Intelligent", "9:29"),
  reharmonization: youtubeVideo("vtmZF9fsm8s", "Reharmonization and MIDI Features in Jam Player", "14:46"),
  chordDatabase: youtubeVideo("91dTEKuc8LE", "The SmartBridge Chord Progression Database", "10:08"),
  jamSessionChords: youtubeVideo("yU3bXdf_Jk8", "Create Your Own Progressions with Jam Session", "4:24"),
  chordPro: youtubeVideo("aKD-5q6FQWQ", "SmartBridge and ChordPro", "5:47"),
  guitarLibraries: youtubeVideo("hnV7lnrGVPY", "SmartBridge Guitar and Performance Libraries", "23:42"),
  superGroove: youtubeVideo("iH_3ZFzr1ik", "Rebuilding Super Groove with SmartBridge", "19:55"),
  cinematicPercussion: youtubeVideo("XAHaz5ASlOk", "Cinematic Percussion in SmartBridge", "5:23"),
  cubase: youtubeVideo("gFQmxucBSio", "SmartBridge Cubase Integration", "11:29"),
  synthV: youtubeVideo("azqq3VBnTQw", "SmartBridge and Synthesizer V Integration", "30:02"),
  rockSong: youtubeVideo("4pg6iBNCIng", "Creating a Rock Song with SmartBridge and Synthesizer V", "34:40"),
  vocalAndSolo: youtubeVideo("spvlH81uyi4", "Vocal Generator and Solo Phrases", "29:29"),
  brassStringsSynthV: youtubeVideo(
    "LN3JklYfcrY",
    "Brass, Strings and Synthesizer V Integration",
    "22:11",
  ),
  soloPhrases: youtubeVideo("UNBGDCi8-Cc", "Solo Phrase Ideas for Music Composition", "9:42"),
  soloPhrases80s: youtubeVideo("1cJNGaID7h8", "Solo Phrases: 80s Power Rock and Pop Rock", "5:59"),
  popHorns: youtubeVideo("2JzTwx45PR4", "Pop Horns Showcase", "10:03"),
  lyricsRock: youtubeVideo("-GMGe_C6Zbk", "Building Lyrics for a Rock Song", "18:11"),
  lyricsBarryImproved: youtubeVideo("UQg8YyiZEn8", "Improved Lyrics Workflow: Soul Ballad Demo", "11:19"),
  lyricsBarrySong: youtubeVideo("Qw2qZm51LhM", "Creating a Soul Song with the Lyrics Feature", "12:14"),
  finishedSong: youtubeVideo("1zKXAAAZrmc", "Finished Song with SmartBridge and Synthesizer V", "5:33"),
  firstVersion: youtubeVideo("RkSi3RGmAYQ", "SmartBridge 1.0 Feature Tour", "21:55"),
  tyrosMotif1: youtubeVideo("QCEmvHhyT58", "Creating a Song with Motif and Tyros — Part 1", "14:51"),
  tyrosMotif2: youtubeVideo("yaPydsXYpVM", "Creating a Song with Tyros and Motif — Part 2", "4:59"),
  lennySong: youtubeVideo("QiQ5DqTEMv4", "Creating a Lenny Kravitz-Inspired Song", "27:28"),
  ballad: youtubeVideo("tuTRgiZ3j0I", "Creating a Ballad in 10 Minutes", "11:15"),
  sysex: youtubeVideo("3NDS378JnJ4", "SmartBridge Instead of SysEx Messages", "2:06"),
  tyrosMixer: youtubeVideo("arHZdbS_Qig", "SmartBridge Tyros Mixer", "3:01"),
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

/** SmartBridge Desktop v1.5 modules, sourced from the current interactive manual. */
export const FEATURE_MODULES: FeatureModule[] = [
  {
    id: "genos-mixer",
    name: "Genos Mixer",
    tag: "Keyboard control",
    image: "/images/desktop-v15/24_genos_mixer_v15.png",
    what: "An on-screen front panel for Genos Style and Song channels, with voice search, volume, pan, chorus, reverb, bass, treble, insert effects, Cubase sync, and complete mix recall.",
    why: "You shape the whole keyboard from one readable screen and save a complete setup per song instead of rebuilding it through hardware menus.",
    highlights: ["Switch between Style channels 1–16 and Song channels 17–32.", "Read the current keyboard state with Refresh, then push or save the finished mix.", "Keep the keyboard and Cubase aligned during production."],
    videos: [VIDEO_LIBRARY.tyrosMixer, VIDEO_LIBRARY.cubase],
  },
  {
    id: "dsp-effects",
    name: "DSP effects",
    tag: "Keyboard control",
    image: "/images/desktop-v15/25_insertion_effects.png",
    what: "A complete view of Genos insertion-effect slots, their assigned parts, searchable effect categories, and detailed editable parameters.",
    why: "You can find, replace, and fine-tune an effect without tracing it through nested keyboard pages.",
    highlights: ["See every insertion slot and its assigned keyboard part.", "Search EQ, compressor, chorus, delay, amp, and other effect families.", "Edit precise effect values from the Effect Details window."],
    videos: [VIDEO_LIBRARY.tyrosMixer, VIDEO_LIBRARY.sysex],
  },
  {
    id: "ensemble",
    name: "Ensemble presets",
    tag: "Keyboard control",
    image: "/images/desktop-v15/26_ensemble_presets.png",
    what: "Ready-made section voicings that assign complementary Genos instruments for pop brass, soul brass, orchestral brass, and other ensemble colours.",
    why: "You get a balanced playable section quickly while still seeing exactly which voice is assigned to each part.",
    highlights: ["Preview the section recipe before applying it.", "Match ensemble colour to the arrangement and keyboard style.", "Use the result with phrase libraries and generated harmonies."],
    videos: [VIDEO_LIBRARY.popHorns, VIDEO_LIBRARY.brassStringsSynthV],
  },
  {
    id: "jam-player",
    name: "Jam Player Tyros",
    tag: "Songs & arrangement",
    image: "/images/desktop-v15/27_jam_player_song_chords.png",
    what: "The song centre for Factory and My Songs charts, ChordPro import, key and BPM, keyboard-style selection, section playback, looping, and a large chord-progression grid.",
    why: "Every rhythm, vocal, and solo tool works against the song loaded here, so the whole arrangement shares the same chords, sections, key, and tempo.",
    highlights: ["Let the Tyros or Genos style follow the complete chord grid.", "Move directly from Song & Chords into Drums & Bass, Vocals, and Solo Instruments.", "Save imported or edited songs and rehearse them with Play, Stop, and Loop."],
    videos: [VIDEO_LIBRARY.jamPlayerTyros, VIDEO_LIBRARY.chordIntelligence, VIDEO_LIBRARY.reharmonization],
  },
  {
    id: "chordpro-import",
    name: "ChordPro song import",
    tag: "Songs & arrangement",
    image: "/images/desktop-v15/28_import_chord_sheet_v15.png",
    what: "A fast route from pasted ChordPro text or a dropped .cho/.chopro file to a parsed, section-aware SmartBridge song.",
    why: "Existing chord sheets become playable arrangements without retyping every chord and section by hand.",
    highlights: ["Paste text or drop a ChordPro file.", "Preview the parsed song before saving.", "Store the result in My Songs for the entire Desktop workflow."],
    videos: [VIDEO_LIBRARY.chordPro, VIDEO_LIBRARY.chordIntelligence],
  },
  {
    id: "bass-library",
    name: "Bass performances",
    tag: "Rhythm section",
    image: "/images/desktop-v15/29_bass_performance.png",
    what: "A library of played bass phrases filtered by tempo, feel, genre, section, source song, articulation, and density, with correct MegaVoice playback.",
    why: "You audition a real performance in the current song instead of programming a bass line from scratch or guessing from a folder name.",
    highlights: ["Filter thousands of clips by the musical job they need to do.", "Preserve slides, hammer-ons, pitch bends, and MegaVoice layers.", "Apply to the Jam Player section or drag the MIDI to Cubase."],
    videos: [VIDEO_LIBRARY.reharmonization, VIDEO_LIBRARY.ballad],
  },
  {
    id: "drum-library",
    name: "Drum grooves & fills",
    tag: "Rhythm section",
    image: "/images/desktop-v15/30_drum_performance.png",
    what: "Played drum grooves with matching fills, feel and tempo filters, bar-slot assignment, and in-context auditioning.",
    why: "The groove and transition fills stay connected, so the section develops like an arrangement instead of repeating one loop.",
    highlights: ["Match straight or swung feel before choosing genre.", "Audition fills made for the selected groove.", "Assign fills to specific bars or drag the complete part to Cubase."],
    videos: [VIDEO_LIBRARY.cinematicPercussion, VIDEO_LIBRARY.finishedSong],
  },
  {
    id: "rhythm-guitar",
    name: "Rhythm Guitar",
    tag: "Rhythm section",
    image: "/images/desktop-v15/31_rhythm_guitar.png",
    what: "A performance generator for chord-aware guitar parts, shaped by mode, genre, technique, meter, feel, and the current song.",
    why: "You get a guitarist-like part that follows the progression rather than a static strum pattern pasted across every chord.",
    highlights: ["Generate parts directly against the current song form.", "Steer technique and feel for pop, funk, disco, rock, and other styles.", "Audition the result, apply it to Jam Player, or drag it to the DAW."],
    videos: [VIDEO_LIBRARY.guitarLibraries, VIDEO_LIBRARY.superGroove],
  },
  {
    id: "vocal-generator",
    name: "Vocal melody ideas",
    tag: "Vocals & lyrics",
    image: "/images/desktop-v15/32_vocals_easy.png",
    what: "Complete section-length vocal melody suggestions chosen by style, range, form, phrase count, motion, and note density.",
    why: "You can compare singable toplines that already fit the song section instead of starting with an empty piano roll.",
    highlights: ["Generate for male, alto, baritone, and other practical ranges.", "Read the shape of each take before auditioning it.", "Save a melody to Jam Player or drag it directly to Cubase."],
    videos: [VIDEO_LIBRARY.vocalAndSolo, VIDEO_LIBRARY.rockSong],
  },
  {
    id: "vocal-phrase-builder",
    name: "Expert melody builder",
    tag: "Vocals & lyrics",
    image: "/images/desktop-v15/33_vocals_expert.png",
    what: "A phrase-by-phrase vocal builder that lays a section out as Statement, Answer, Continue, and Cadence, with musical suggestions for every slot.",
    why: "You control the dramatic shape of the topline while SmartBridge handles chord fit, range, phrasing, and candidate selection.",
    highlights: ["Lock phrases you already like while replacing the rest.", "Choose melismatic or syllabic delivery per phrase.", "Audition one phrase or the full section with metronome and accompaniment."],
    videos: [VIDEO_LIBRARY.vocalAndSolo, VIDEO_LIBRARY.synthV],
  },
  {
    id: "vocal-harmonizer",
    name: "Vocal Harmonizer",
    tag: "Vocals & lyrics",
    image: "/images/desktop-v15/34_vocals_harmonizer.png",
    what: "A harmony workshop for stacking backing voices under the lead with voice profiles, polyphony, harmony styles, and humanised timing.",
    why: "You hear the complete vocal arrangement before the DAW and export every voice separately when the stack is ready.",
    highlights: ["Choose Lead + 1 or larger harmony stacks.", "Humanise backing voices so they do not sound pasted together.", "Drag the lead, individual harmonies, or all voices to Cubase."],
    videos: [VIDEO_LIBRARY.brassStringsSynthV, VIDEO_LIBRARY.finishedSong],
  },
  {
    id: "vocal-synthv",
    name: "Lyrics & Synthesizer V",
    tag: "Vocals & lyrics",
    image: "/images/desktop-v15/35_vocals_daw_import.png",
    what: "A DAW-import workflow that maps generated lyrics syllable by syllable to a MIDI melody, then sends the result to Synthesizer V at the playhead.",
    why: "The words follow the melody’s actual phrasing, and the complete vocal sketch moves between Cubase, SmartBridge, and SynthV without manual rebuilding.",
    highlights: ["Drop a melody from Cubase or use a SmartBridge melody.", "Steer hooks with catch phrases, repeats, song theme, mood, keywords, and avoid lists.", "Send chords and the finished vocal directly to Synthesizer V."],
    videos: [VIDEO_LIBRARY.synthV, VIDEO_LIBRARY.lyricsRock, VIDEO_LIBRARY.finishedSong],
  },
  {
    id: "solo-generator",
    name: "Solo Generator",
    tag: "Solos & harmony",
    image: "/images/desktop-v15/37_solo_ideas.png",
    what: "A full phrase workshop for instrumental lines, with instrument-aware range and idiom, genre, multi-section form, breathing room, groove, voicing, decorations, and band audition.",
    why: "The solo develops like a musical statement instead of wandering, and you can understand why each phrase matches before editing it.",
    highlights: ["Choose AABA, ABAB, AABB, ABAC, ABC, or repeating motif forms.", "Import your own melody without normalising or octave-shifting it.", "Audition with the band, decorate the line, save it, or drag it to Cubase."],
    videos: [VIDEO_LIBRARY.soloPhrases, VIDEO_LIBRARY.soloPhrases80s],
  },
  {
    id: "piano-roll",
    name: "Chord-aware Piano Roll",
    tag: "Solos & harmony",
    image: "/images/desktop-v15/38_piano_roll_editor.png",
    what: "A note editor that sees the chord under every bar and uses that context for harmony repair, ornaments, approach notes, dynamics, groove, and pitch-bend-aware editing.",
    why: "Corrective tools make musical decisions while preserving the feel, swing, pickups, passing tones, and expression that made the phrase worth keeping.",
    highlights: ["Fix harmony or only the notes that clash.", "Drop real riffs, trills, bends, slides, falls, licks, and swells in Adaptive or Free mode.", "Audition with the band and drag melody and horn channels separately."],
    videos: [VIDEO_LIBRARY.soloPhrases, VIDEO_LIBRARY.vocalAndSolo],
  },
  {
    id: "solo-brass-harmonizer",
    name: "Brass Harmonizer",
    tag: "Solos & harmony",
    image: "/images/desktop-v15/39_brass_harmonizer.png",
    what: "A chord-aware arranger that turns one lead into a four-part brass section with voicing type, humanisation, and range-aware alto, tenor, and bass writing.",
    why: "A single melodic idea becomes a playable horn section without manually voicing every chord and register.",
    highlights: ["Detect the lead range before voicing the section.", "Drag or export each voice separately.", "Export all voices together when the arrangement is ready."],
    videos: [VIDEO_LIBRARY.popHorns, VIDEO_LIBRARY.brassStringsSynthV],
  },
  {
    id: "solo-strings-harmonizer",
    name: "Strings Harmonizer",
    tag: "Solos & harmony",
    image: "/images/desktop-v15/40_strings_harmonizer.png",
    what: "Preset-led string writing for violin, viola, cello, and support layers, built around the current lead and harmony.",
    why: "You add orchestral weight that supports the melody without covering it or requiring a full manual orchestration pass.",
    highlights: ["Choose lighter or fuller string textures with clear preset guidance.", "Keep every section voice in a practical register.", "Drag or export the individual parts or complete strings track."],
    videos: [VIDEO_LIBRARY.brassStringsSynthV, VIDEO_LIBRARY.cinematicPercussion],
  },
  {
    id: "motif-mixer",
    name: "Motif Mixer",
    tag: "Motif workflow",
    image: "/images/desktop-v15/42_motif_mixer_v15.png",
    what: "A computer-based mixer for Motif parts, voices, EQ, insertion effects, arpeggiators, chorus, reverb, pan, level, full-mix recall, and Riff Maker access.",
    why: "You shape a Motif MULTI comfortably on one screen, save it per song, and keep the software and hardware state aligned.",
    highlights: ["Search voices and enable Ins.FX or ARP per part.", "Refresh from the Motif or Send All back to it.", "Save and load complete Motif mixes for songs and projects."],
    videos: [VIDEO_LIBRARY.tyrosMotif1, VIDEO_LIBRARY.tyrosMotif2],
  },
  {
    id: "riff-maker",
    name: "Riff Maker",
    tag: "Motif workflow",
    image: "/images/desktop-v15/43_riff_maker_v15.png",
    what: "A Motif arp workstation for searching thousands of riffs, assigning chords per bar or from MIDI, auditioning through the real Motif voice, capturing the output, and dragging the recording to the DAW.",
    why: "The Motif becomes an idea partner: its arps follow your progression, then arrive in Cubase as editable MIDI rather than a locked performance.",
    highlights: ["Filter arps by name, category, prefix, time signature, and length.", "Capture notes, CC, pitch bend, and realtime chord changes when needed.", "Double-click to play and record, then drag the result straight to Cubase."],
    videos: [VIDEO_LIBRARY.tyrosMotif1, VIDEO_LIBRARY.cubase],
  },
  {
    id: "jam-player-motif",
    name: "Jam Player Motif",
    tag: "Motif workflow",
    image: "/images/desktop-v15/44_jam_player_motif_v15.png",
    what: "The SmartBridge song grid connected to Motif MULTI sounds and arpeggiators, with key, BPM, sync, variation, active channels, playback, loop, and section recording.",
    why: "You can rehearse and sketch complete harmonic forms while the Motif’s parts and arps follow the same chord flow.",
    highlights: ["Load Factory or My Songs charts.", "Choose and send a Motif MULTI, then enable Global ARP.", "Control which channels follow the progression and record selected sections."],
    videos: [VIDEO_LIBRARY.tyrosMotif1, VIDEO_LIBRARY.tyrosMotif2],
  },
  {
    id: "jam-session",
    name: "Jam Session",
    tag: "Songs & arrangement",
    image: "/images/desktop-v15/45_jam_session_v15.png",
    what: "A songwriting timeline with song management, transport, Lock On, keyboard-master sync, chord blocks, arrangement blocks, and reusable clips that keep chords and MIDI together.",
    why: "Ideas played on the keyboard become editable song structure instead of disappearing after the session.",
    highlights: ["Create, save, rename, and delete songs from the session bar.", "Record, import, replace, or clear chord and MIDI data per clip.", "Run the timeline while the connected keyboard follows the chords and arrangement."],
    videos: [VIDEO_LIBRARY.jamSessionChords, VIDEO_LIBRARY.tyrosMotif1],
  },
  {
    id: "style-maker-desktop",
    name: "Desktop Style Maker",
    tag: "Style creation",
    image: "/images/desktop-v15/46_style_maker_build.png",
    what: "A native Yamaha style builder for Intro, Main, Fill, and Ending sections, with eight style channels, a built-in clip browser, per-section Audition Lab, validation, .prs/.sty export, and direct keyboard transfer.",
    why: "You create a genuine accompaniment style that follows whatever chords you play on the keyboard—not a MIDI file that depends on the computer for playback.",
    highlights: ["Start from a donor style and replace the musical content section by section.", "Mix voices, volume, pan, reverb, and chorus for channels 9–16 in Audition Lab.", "Validate, export for the keyboard or Cubase, or transfer directly into Yamaha user storage."],
    videos: [VIDEO_LIBRARY.firstVersion, VIDEO_LIBRARY.reharmonization],
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
    summary: "Introduces the original SmartBridge idea: a bridge between Cubase, Tyros 5, and Motif Rack XS with computer-based mixers, Jam Player progressions for Yamaha styles and arpeggios, and Jam Session for recording your own chords.",
    video: VIDEO_LIBRARY.intro,
    featureIds: ["genos-mixer", "motif-mixer", "jam-player", "jam-session"],
  },
  {
    title: "Jam Player: Tyros Edition",
    summary: "Walks through the categorized chord-progression library, matches progressions to Tyros styles by genre and tempo, plays sections with automatic style variations and fills, then records the result and sends its chords into Cubase.",
    video: VIDEO_LIBRARY.jamPlayerTyros,
    featureIds: ["jam-player"],
  },
  {
    title: "Jam Player Showcase",
    summary: "Auditions several curated progressions against Genos 2 styles, showing complete intro, verse, pre-chorus, and chorus structures with rhythmic chord changes—not isolated four-chord loops.",
    video: VIDEO_LIBRARY.jamPlayerShowcase,
    featureIds: ["jam-player"],
  },
  {
    title: "SmartBridge Becomes Chord-Intelligent",
    summary: "Creates a simple progression in Jam Session, then edits it in Jam Player with a circle-of-fifths picker, context-aware safe-to-colorful chord suggestions, live preview, and precise add, delete, resize, and move controls.",
    video: VIDEO_LIBRARY.chordIntelligence,
    featureIds: ["jam-player", "jam-session"],
  },
  {
    title: "Reharmonization and MIDI Features in Jam Player",
    summary: "Turns a plain C–F–G–C progression into funk, gospel, jazz, and neo-soul variants using approach chords, substitutions, modal interchange, chromatic mediants, and bass motion—then demonstrates chord-aware bass, drum, and fill replacements.",
    video: VIDEO_LIBRARY.reharmonization,
    featureIds: ["jam-player", "jam-session", "bass-library", "drum-library"],
  },
  {
    title: "The SmartBridge Chord Progression Database",
    summary: "Explains how hundreds of source progressions were enriched with harmonic theory and arranged into intro, verse, pre-chorus, and chorus sections, then shows how to filter them by genre and tempo and record them with matching Yamaha styles.",
    video: VIDEO_LIBRARY.chordDatabase,
    featureIds: ["jam-player"],
  },
  {
    title: "Create Your Own Progressions with Jam Session",
    summary: "Creates a new song from named clips, records chord changes from a Tyros or Genos in a Chord Looper-style workflow, saves the sections, and reopens the finished progression in Jam Player.",
    video: VIDEO_LIBRARY.jamSessionChords,
    featureIds: ["jam-session", "jam-player"],
  },
  {
    title: "SmartBridge and ChordPro",
    summary: "Imports ChordPro charts for songs such as “Rosanna” and “Eye of the Tiger,” parses their lyrics, chords, and section instructions, plays them with Jam Player’s variations and fills, and keeps them available for recording and further chord editing.",
    video: VIDEO_LIBRARY.chordPro,
    featureIds: ["chordpro-import", "jam-player", "jam-session"],
  },
  {
    title: "SmartBridge Guitar and Performance Libraries",
    summary: "Replaces repetitive arranger parts with generated rhythm-guitar takes assembled from played clips, then demonstrates articulation-aware bass phrases, expressive brass performances, four-part horn export, and ready-made Genos ensemble voicings.",
    video: VIDEO_LIBRARY.guitarLibraries,
    featureIds: ["rhythm-guitar", "bass-library", "ensemble"],
  },
  {
    title: "Rebuilding Super Groove with SmartBridge",
    summary: "Reworks a recognizable Yamaha funk style into an original arrangement by reharmonizing the song and layering SmartBridge percussion, bass, guitar, and brass clips section by section in Cubase.",
    video: VIDEO_LIBRARY.superGroove,
    featureIds: ["jam-player", "bass-library", "drum-library", "rhythm-guitar", "genos-mixer"],
  },
  {
    title: "Cinematic Percussion in SmartBridge",
    summary: "Starts from SmartBridge’s cinematic progression category, records a scoring-style section, then selects four-bar percussion performances and one-bar fills, assigns fills to specific bars, and drags the finished part into Cubase.",
    video: VIDEO_LIBRARY.cinematicPercussion,
    featureIds: ["jam-player", "drum-library"],
  },
  {
    title: "SmartBridge Cubase Integration",
    summary: "Tours Genos 2 control for all 32 style and song channels, detailed insertion-effect editing, one-click brass and string ensembles, automatic Cubase track renaming through MIDI Remote, and reusable mix snapshots.",
    video: VIDEO_LIBRARY.cubase,
    featureIds: ["genos-mixer", "dsp-effects", "ensemble"],
  },
  {
    title: "SmartBridge and Synthesizer V Integration",
    summary: "Imports section melodies from Cubase, generates lyrics from title, theme, mood, keywords, and chorus-hook directions, sends melody and words to Synthesizer V at the playhead, then builds chord-aware multi-voice harmonies with range and humanization controls.",
    video: VIDEO_LIBRARY.synthV,
    featureIds: ["jam-player", "vocal-synthv", "vocal-harmonizer"],
  },
  {
    title: "Creating a Rock Song with SmartBridge and Synthesizer V",
    summary: "An end-to-end build using a mapped Cubase template, Genos style sections, a played bass line, Motif drum and guitar riffs, SmartBridge lyric and hook generation, Synthesizer V vocal presets, and four chord-aware backing voices.",
    video: VIDEO_LIBRARY.rockSong,
    featureIds: ["jam-player", "riff-maker", "vocal-synthv", "vocal-harmonizer"],
  },
  {
    title: "Vocal Generator and Solo Phrases",
    summary: "Builds a Latin-style song while demonstrating the vocal-melody library, chord matching, lyric generation, direct Synthesizer V transfer, chord-aware vocal harmony, and an instrumental solo chosen from roughly 1,800 played phrase clips.",
    video: VIDEO_LIBRARY.vocalAndSolo,
    featureIds: ["jam-player", "vocal-generator", "vocal-harmonizer", "vocal-synthv", "solo-generator"],
  },
  {
    title: "Brass, Strings and Synthesizer V Integration",
    summary: "Turns a monophonic line into humanized, chord-aware brass and string arrangements using style presets, then demonstrates two-way melody transfer, lyric generation, and automatic backing-vocal creation through the SmartBridge panel in Synthesizer V.",
    video: VIDEO_LIBRARY.brassStringsSynthV,
    featureIds: ["vocal-harmonizer", "solo-brass-harmonizer", "solo-strings-harmonizer", "vocal-synthv"],
  },
  {
    title: "Solo Phrase Ideas for Music Composition",
    summary: "Explains how played riffs—not random note generation—are selected and assembled into chord-aware solos using style, tempo, instrument, and energy-arc templates, then auditioned, transposed, saved, and moved into the production.",
    video: VIDEO_LIBRARY.soloPhrases,
    featureIds: ["solo-generator"],
  },
  {
    title: "Solo Phrases: 80s Power Rock and Pop Rock",
    summary: "Applies the solo-phrase workflow to a fast 80s power-rock arrangement: compare candidates, move a phrase into the right register, save the best take, drag it into Cubase, and correct any remaining notes against the chords.",
    video: VIDEO_LIBRARY.soloPhrases80s,
    featureIds: ["jam-player", "solo-generator"],
  },
  {
    title: "Pop Horns Showcase",
    summary: "Contrasts short funk-horn stabs with a tenor-sax phrase, filters candidates from minimal to busy, keeps preferred takes, avoids clashes between parts, and assigns the exported MIDI to suitable Tyros horn voices in Cubase.",
    video: VIDEO_LIBRARY.popHorns,
    featureIds: ["solo-generator", "ensemble", "genos-mixer"],
  },
  {
    title: "Building Lyrics for a Rock Song",
    summary: "Exports a marker-structured MIDI melody from Cubase, lets SmartBridge identify sections and vocal phrases, maps generated words syllable by syllable, repeats selected choruses, and moves the result into Synthesizer V for editing and backing vocals.",
    video: VIDEO_LIBRARY.lyricsRock,
    featureIds: ["vocal-synthv"],
  },
  {
    title: "Improved Lyrics Workflow: Soul Ballad Demo",
    summary: "Shows how note length, legato phrasing, section markers, and creative direction guide the lyric engine; compares online and local language-model options, then adds a required chorus hook and retries the text before exporting to Synthesizer V.",
    video: VIDEO_LIBRARY.lyricsBarryImproved,
    featureIds: ["vocal-synthv"],
  },
  {
    title: "Creating a Soul Song with the Lyrics Feature",
    summary: "Introduces the original lyrics prototype with a dark soul ballad: import a MIDI melody, generate words that respect note duration, syllables, and melismas, export a vocal-ready project, and hear it performed by a Synthesizer V voice.",
    video: VIDEO_LIBRARY.lyricsBarrySong,
    featureIds: ["vocal-synthv"],
  },
  {
    title: "Finished Song with SmartBridge and Synthesizer V",
    summary: "Breaks down the completed rock production: three drum layers, doubled Genos and Motif bass, five wide-panned guitars, revised SmartBridge lyrics and vocal harmonies, plus an added solo and doubled guitar parts.",
    video: VIDEO_LIBRARY.finishedSong,
    featureIds: ["vocal-synthv", "vocal-harmonizer", "drum-library", "motif-mixer"],
  },
  {
    title: "SmartBridge 1.0 Feature Tour",
    summary: "Tours the redesigned interface, filters the factory progression library, applies genre-specific reharmonization templates, and then replaces style parts with longer bass performances, drum grooves and fills, percussion, and generated rhythm guitar.",
    video: VIDEO_LIBRARY.firstVersion,
    featureIds: ["jam-player", "bass-library", "drum-library", "rhythm-guitar"],
  },
  {
    title: "Creating a Song with Motif and Tyros — Part 1",
    summary: "Builds a track from a bass idea using Motif Riff Maker drums and guitar arpeggios, records a custom progression in Jam Session, brings in Tyros style parts through Jam Player, and develops the intro, verse, pre-chorus, and chorus in Cubase.",
    video: VIDEO_LIBRARY.tyrosMotif1,
    featureIds: ["motif-mixer", "riff-maker", "jam-player-motif", "jam-session", "jam-player"],
  },
  {
    title: "Creating a Song with Tyros and Motif — Part 2",
    summary: "Reviews the arrangement from part one, then uses the Tyros mixer to choose a funk alto sax for the lead and layers it with a jazz trumpet, demonstrating how Tyros voices finish a Motif-driven production.",
    video: VIDEO_LIBRARY.tyrosMotif2,
    featureIds: ["motif-mixer", "genos-mixer", "jam-player"],
  },
  {
    title: "Creating a Lenny Kravitz-Inspired Song",
    summary: "Develops a riff-led funk-rock song from a Jam Session progression, programs Motif guitar, bass, and drum parts in Riff Maker, borrows contrasting Jam Player sections, layers Tyros and Motif sounds, and thickens the final drums.",
    video: VIDEO_LIBRARY.lennySong,
    featureIds: ["jam-session", "jam-player", "riff-maker", "motif-mixer"],
  },
  {
    title: "Creating a Ballad in 10 Minutes",
    summary: "Creates a ballad mockup from a SmartBridge progression, records Tyros style sections, replaces and layers parts with Motif drums, bass, and arpeggios, and arranges the complete idea in Cubase in roughly ten minutes.",
    video: VIDEO_LIBRARY.ballad,
    featureIds: ["jam-player", "riff-maker", "motif-mixer"],
  },
  {
    title: "SmartBridge Instead of SysEx Messages",
    summary: "Contrasts manual Cubase bank-select, LSB, program-change, and controller editing with choosing a Tyros voice in SmartBridge, where the correct DSP assignment and full sound are restored automatically.",
    video: VIDEO_LIBRARY.sysex,
    featureIds: ["genos-mixer", "dsp-effects"],
  },
  {
    title: "SmartBridge Tyros Mixer",
    summary: "Demonstrates bidirectional control of all 32 Tyros channels, fast voice selection, automatic DSP handling and effect editing, plus complete save-and-load snapshots that restore the underlying style and customized mix.",
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
