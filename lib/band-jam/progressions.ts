import type { Progression } from "@/lib/band-jam/types"

/** Curated pilot progressions (~25). Roots are pitch classes in the progression's native key. */

function sec(
  role: Progression["sections"][number]["role"],
  bars: number,
  chords: Progression["sections"][number]["chords"],
) {
  return { role, bars, chords }
}

function c(startBeat: number, durationBeats: number, root: number, name: string) {
  return { startBeat, durationBeats, root, name }
}

export const PILOT_PROGRESSIONS: Progression[] = [
  {
    id: "am7-d9-vamp",
    name: "Am7 – D9 vamp",
    keyPc: 9,
    keyLabel: "Am",
    tempo: 116,
    sections: [
      sec("intro", 4, [c(0, 16, 9, "Am7")]),
      sec("verse", 8, [
        c(0, 8, 9, "Am7"),
        c(8, 8, 2, "D9"),
        c(16, 8, 9, "Am7"),
        c(24, 8, 2, "D9"),
      ]),
      sec("chorus", 8, [
        c(0, 8, 5, "F9"),
        c(8, 8, 7, "G13"),
        c(16, 8, 9, "Am7"),
        c(24, 4, 4, "E7#9"),
        c(28, 4, 9, "Am7"),
      ]),
    ],
  },
  {
    id: "pop-1-5-6-4",
    name: "I – V – vi – IV",
    keyPc: 0,
    keyLabel: "C",
    sections: [
      sec("verse", 8, [
        c(0, 8, 0, "C"),
        c(8, 8, 7, "G"),
        c(16, 8, 9, "Am"),
        c(24, 8, 5, "F"),
      ]),
      sec("chorus", 8, [
        c(0, 8, 0, "C"),
        c(8, 8, 7, "G"),
        c(16, 8, 9, "Am"),
        c(24, 8, 5, "F"),
      ]),
    ],
  },
  {
    id: "pop-6-4-1-5",
    name: "vi – IV – I – V",
    keyPc: 0,
    keyLabel: "C",
    sections: [
      sec("verse", 8, [
        c(0, 8, 9, "Am"),
        c(8, 8, 5, "F"),
        c(16, 8, 0, "C"),
        c(24, 8, 7, "G"),
      ]),
      sec("chorus", 8, [
        c(0, 8, 9, "Am"),
        c(8, 8, 5, "F"),
        c(16, 8, 0, "C"),
        c(24, 8, 7, "G"),
      ]),
    ],
  },
  {
    id: "blues-12-a",
    name: "12-bar blues (A)",
    keyPc: 9,
    keyLabel: "A",
    sections: [
      sec("verse", 12, [
        c(0, 16, 9, "A7"),
        c(16, 8, 2, "D7"),
        c(24, 8, 9, "A7"),
        c(32, 8, 4, "E7"),
        c(40, 8, 9, "A7"),
      ]),
    ],
  },
  {
    id: "jazz-2-5-1",
    name: "ii – V – I",
    keyPc: 0,
    keyLabel: "C",
    sections: [
      sec("verse", 8, [
        c(0, 8, 2, "Dm7"),
        c(8, 8, 7, "G7"),
        c(16, 16, 0, "Cmaj7"),
      ]),
      sec("chorus", 8, [
        c(0, 8, 2, "Dm7"),
        c(8, 8, 7, "G7"),
        c(16, 16, 0, "Cmaj7"),
      ]),
    ],
  },
  {
    id: "jazz-turnaround",
    name: "I – vi – ii – V",
    keyPc: 0,
    keyLabel: "C",
    sections: [
      sec("verse", 8, [
        c(0, 8, 0, "Cmaj7"),
        c(8, 8, 9, "Am7"),
        c(16, 8, 2, "Dm7"),
        c(24, 8, 7, "G7"),
      ]),
      sec("chorus", 8, [
        c(0, 8, 0, "Cmaj7"),
        c(8, 8, 9, "Am7"),
        c(16, 8, 2, "Dm7"),
        c(24, 8, 7, "G7"),
      ]),
    ],
  },
  {
    id: "soul-1-4-1-5",
    name: "Soul I – IV – I – V",
    keyPc: 5,
    keyLabel: "F",
    sections: [
      sec("verse", 8, [
        c(0, 8, 5, "F7"),
        c(8, 8, 10, "Bb7"),
        c(16, 8, 5, "F7"),
        c(24, 8, 0, "C7"),
      ]),
      sec("chorus", 8, [
        c(0, 8, 5, "F9"),
        c(8, 8, 10, "Bb9"),
        c(16, 8, 5, "F9"),
        c(24, 8, 0, "C9"),
      ]),
    ],
  },
  {
    id: "dorian-vamp",
    name: "Dm7 – G7 dorian vamp",
    keyPc: 2,
    keyLabel: "Dm",
    sections: [
      sec("verse", 8, [
        c(0, 8, 2, "Dm7"),
        c(8, 8, 7, "G7"),
        c(16, 8, 2, "Dm7"),
        c(24, 8, 7, "G7"),
      ]),
      sec("chorus", 8, [
        c(0, 8, 2, "Dm9"),
        c(8, 8, 7, "G13"),
        c(16, 8, 2, "Dm9"),
        c(24, 8, 7, "G13"),
      ]),
    ],
  },
  {
    id: "ballad-1-3-4-5",
    name: "Ballad I – iii – IV – V",
    keyPc: 7,
    keyLabel: "G",
    tempo: 72,
    sections: [
      sec("verse", 8, [
        c(0, 8, 7, "G"),
        c(8, 8, 11, "Bm"),
        c(16, 8, 0, "C"),
        c(24, 8, 2, "D"),
      ]),
      sec("chorus", 8, [
        c(0, 8, 7, "G"),
        c(8, 8, 4, "Em"),
        c(16, 8, 0, "C"),
        c(24, 8, 2, "D"),
      ]),
    ],
  },
  {
    id: "ballad-6-2-5-1",
    name: "Ballad vi – ii – V – I",
    keyPc: 0,
    keyLabel: "C",
    tempo: 70,
    sections: [
      sec("verse", 8, [
        c(0, 8, 9, "Am"),
        c(8, 8, 2, "Dm"),
        c(16, 8, 7, "G"),
        c(24, 8, 0, "C"),
      ]),
      sec("chorus", 8, [
        c(0, 8, 9, "Am7"),
        c(8, 8, 2, "Dm7"),
        c(16, 8, 7, "G7"),
        c(24, 8, 0, "C"),
      ]),
    ],
  },
  {
    id: "rock-1-bVII-IV",
    name: "Rock I – bVII – IV",
    keyPc: 7,
    keyLabel: "G",
    sections: [
      sec("verse", 8, [
        c(0, 8, 7, "G"),
        c(8, 8, 5, "F"),
        c(16, 8, 0, "C"),
        c(24, 8, 7, "G"),
      ]),
      sec("chorus", 8, [
        c(0, 8, 7, "G"),
        c(8, 8, 5, "F"),
        c(16, 8, 0, "C"),
        c(24, 8, 7, "G"),
      ]),
    ],
  },
  {
    id: "funk-1-4-vamp",
    name: "Funk E7 – A7 vamp",
    keyPc: 4,
    keyLabel: "E",
    tempo: 112,
    sections: [
      sec("intro", 4, [c(0, 16, 4, "E7")]),
      sec("verse", 8, [
        c(0, 8, 4, "E7"),
        c(8, 8, 9, "A7"),
        c(16, 8, 4, "E7"),
        c(24, 8, 9, "A7"),
      ]),
      sec("chorus", 8, [
        c(0, 8, 4, "E9"),
        c(8, 8, 9, "A9"),
        c(16, 8, 4, "E9"),
        c(24, 8, 11, "B7"),
      ]),
    ],
  },
  {
    id: "gospel-1-4-1-5",
    name: "Gospel I – IV – I – V",
    keyPc: 0,
    keyLabel: "C",
    sections: [
      sec("verse", 8, [
        c(0, 8, 0, "C"),
        c(8, 8, 5, "F"),
        c(16, 8, 0, "C"),
        c(24, 8, 7, "G"),
      ]),
      sec("chorus", 8, [
        c(0, 8, 0, "C"),
        c(8, 8, 5, "F"),
        c(16, 8, 9, "Am"),
        c(24, 8, 7, "G"),
      ]),
    ],
  },
  {
    id: "latin-2-5",
    name: "Latin ii – V loop",
    keyPc: 2,
    keyLabel: "Dm",
    sections: [
      sec("verse", 8, [
        c(0, 8, 2, "Dm7"),
        c(8, 8, 7, "G7"),
        c(16, 8, 2, "Dm7"),
        c(24, 8, 7, "G7"),
      ]),
      sec("chorus", 8, [
        c(0, 8, 2, "Dm9"),
        c(8, 8, 7, "G13"),
        c(16, 8, 0, "Cmaj7"),
        c(24, 8, 9, "Am7"),
      ]),
    ],
  },
  {
    id: "modal-em-vamp",
    name: "Em modal vamp",
    keyPc: 4,
    keyLabel: "Em",
    sections: [
      sec("verse", 8, [
        c(0, 16, 4, "Em"),
        c(16, 16, 4, "Em"),
      ]),
      sec("chorus", 8, [
        c(0, 8, 0, "C"),
        c(8, 8, 7, "G"),
        c(16, 8, 4, "Em"),
        c(24, 8, 2, "D"),
      ]),
    ],
  },
  {
    id: "country-1-4-5",
    name: "Country I – IV – V",
    keyPc: 7,
    keyLabel: "G",
    sections: [
      sec("verse", 8, [
        c(0, 8, 7, "G"),
        c(8, 8, 0, "C"),
        c(16, 8, 7, "G"),
        c(24, 8, 2, "D"),
      ]),
      sec("chorus", 8, [
        c(0, 8, 0, "C"),
        c(8, 8, 7, "G"),
        c(16, 8, 2, "D"),
        c(24, 8, 7, "G"),
      ]),
    ],
  },
  {
    id: "rnb-1-b3-4",
    name: "R&B I – bIII – IV",
    keyPc: 0,
    keyLabel: "C",
    sections: [
      sec("verse", 8, [
        c(0, 8, 0, "Cmin7"),
        c(8, 8, 3, "Eb"),
        c(16, 8, 5, "F"),
        c(24, 8, 0, "Cmin7"),
      ]),
      sec("chorus", 8, [
        c(0, 8, 0, "Cmin7"),
        c(8, 8, 3, "Eb"),
        c(16, 8, 5, "F"),
        c(24, 8, 10, "Bb"),
      ]),
    ],
  },
  {
    id: "neo-soul-251",
    name: "Neo-soul ii – V – I",
    keyPc: 5,
    keyLabel: "F",
    sections: [
      sec("verse", 8, [
        c(0, 8, 7, "Gm7"),
        c(8, 8, 0, "C7"),
        c(16, 16, 5, "Fmaj7"),
      ]),
      sec("chorus", 8, [
        c(0, 8, 7, "Gm9"),
        c(8, 8, 0, "C13"),
        c(16, 16, 5, "Fmaj9"),
      ]),
    ],
  },
  {
    id: "andalusian",
    name: "Andalusian cadence",
    keyPc: 9,
    keyLabel: "Am",
    sections: [
      sec("verse", 8, [
        c(0, 8, 9, "Am"),
        c(8, 8, 7, "G"),
        c(16, 8, 5, "F"),
        c(24, 8, 4, "E"),
      ]),
      sec("chorus", 8, [
        c(0, 8, 9, "Am"),
        c(8, 8, 7, "G"),
        c(16, 8, 5, "F"),
        c(24, 8, 4, "E7"),
      ]),
    ],
  },
  {
    id: "axis-4-1-5-6",
    name: "Axis IV – I – V – vi",
    keyPc: 0,
    keyLabel: "C",
    sections: [
      sec("verse", 8, [
        c(0, 8, 5, "F"),
        c(8, 8, 0, "C"),
        c(16, 8, 7, "G"),
        c(24, 8, 9, "Am"),
      ]),
      sec("chorus", 8, [
        c(0, 8, 5, "F"),
        c(8, 8, 0, "C"),
        c(16, 8, 7, "G"),
        c(24, 8, 9, "Am"),
      ]),
    ],
  },
  {
    id: "canon-like",
    name: "Canon-like I – V – vi – iii",
    keyPc: 0,
    keyLabel: "C",
    sections: [
      sec("verse", 8, [
        c(0, 8, 0, "C"),
        c(8, 8, 7, "G"),
        c(16, 8, 9, "Am"),
        c(24, 8, 4, "Em"),
      ]),
      sec("chorus", 8, [
        c(0, 8, 5, "F"),
        c(8, 8, 0, "C"),
        c(16, 8, 5, "F"),
        c(24, 8, 7, "G"),
      ]),
    ],
  },
  {
    id: "minor-1-b6-b7",
    name: "Minor i – bVI – bVII",
    keyPc: 9,
    keyLabel: "Am",
    sections: [
      sec("verse", 8, [
        c(0, 8, 9, "Am"),
        c(8, 8, 5, "F"),
        c(16, 8, 7, "G"),
        c(24, 8, 9, "Am"),
      ]),
      sec("chorus", 8, [
        c(0, 8, 5, "F"),
        c(8, 8, 7, "G"),
        c(16, 8, 9, "Am"),
        c(24, 8, 4, "E"),
      ]),
    ],
  },
  {
    id: "sus-resolve",
    name: "Sus resolve loop",
    keyPc: 0,
    keyLabel: "C",
    sections: [
      sec("verse", 8, [
        c(0, 8, 2, "Dsus"),
        c(8, 8, 7, "G"),
        c(16, 8, 0, "C"),
        c(24, 8, 0, "C"),
      ]),
      sec("chorus", 8, [
        c(0, 8, 5, "F"),
        c(8, 8, 7, "Gsus"),
        c(16, 8, 7, "G"),
        c(24, 8, 0, "C"),
      ]),
    ],
  },
  {
    id: "four-on-floor-pop",
    name: "Four-chord pop (G)",
    keyPc: 7,
    keyLabel: "G",
    sections: [
      sec("verse", 8, [
        c(0, 8, 7, "G"),
        c(8, 8, 4, "Em"),
        c(16, 8, 0, "C"),
        c(24, 8, 2, "D"),
      ]),
      sec("chorus", 8, [
        c(0, 8, 7, "G"),
        c(8, 8, 4, "Em"),
        c(16, 8, 0, "C"),
        c(24, 8, 2, "D"),
      ]),
    ],
  },
  {
    id: "funk-cm-vamp",
    name: "Cm7 funk vamp",
    keyPc: 0,
    keyLabel: "Cm",
    tempo: 100,
    sections: [
      sec("intro", 4, [c(0, 16, 0, "Cm7")]),
      sec("verse", 8, [
        c(0, 8, 0, "Cm7"),
        c(8, 8, 5, "F7"),
        c(16, 8, 0, "Cm7"),
        c(24, 8, 5, "F7"),
      ]),
      sec("chorus", 8, [
        c(0, 8, 3, "Eb9"),
        c(8, 8, 5, "F9"),
        c(16, 8, 0, "Cm7"),
        c(24, 8, 7, "G7"),
      ]),
    ],
  },
]
