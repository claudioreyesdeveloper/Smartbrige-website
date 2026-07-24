import type {
  KeyboardProfile,
  StyleGenre,
  StyleWireMapping,
  YamahaModelId,
} from "@/lib/demo/types"

const genosMappings: Record<StyleGenre, StyleWireMapping> = {
  Pop: { name: "EasyPop", category: "Pop", bytes: [0x2e, 0x22], sourceCatalogValue: 5922 },
  Jazz: { name: "AcousticJazz", category: "Jazz", bytes: [0x1e, 0x20], sourceCatalogValue: 3872 },
  Gospel: { name: "AmazingGospel", category: "R&B", bytes: [0x2b, 0x62], sourceCatalogValue: 5602 },
  "Neo Soul": { name: "Soul", category: "R&B", bytes: [0x2d, 0x02], sourceCatalogValue: 5762 },
  Funk: { name: "JazzFunk", category: "R&B", bytes: [0x41, 0x04], sourceCatalogValue: 8324 },
}

const tyrosMappings: Record<StyleGenre, StyleWireMapping> = {
  Pop: { name: "EasyPop", category: "Pop & Rock", bytes: [0x17, 0x22], sourceCatalogValue: 5922 },
  Jazz: { name: "AcousticJazz", category: "Swing & Jazz", bytes: [0x0f, 0x20], sourceCatalogValue: 3872 },
  Gospel: { name: "AmazingGospel", category: "R&B", bytes: [0x15, 0x62], sourceCatalogValue: 5602 },
  "Neo Soul": { name: "SoulBeat", category: "R&B", bytes: [0x16, 0x02], sourceCatalogValue: 5762 },
  Funk: { name: "JazzFunk", category: "R&B", bytes: [0x20, 0x04], sourceCatalogValue: 8324 },
}

function profile(
  id: YamahaModelId,
  displayName: string,
  identityTokens: string[],
  oneClickActivation: boolean,
  styleMappings: Record<StyleGenre, StyleWireMapping>,
): KeyboardProfile {
  return { id, displayName, identityTokens, oneClickActivation, styleMappings }
}

export const KEYBOARD_PROFILES: Record<YamahaModelId, KeyboardProfile> = {
  genos: profile("genos", "Genos", ["genos", "genos1"], true, genosMappings),
  genos2: profile("genos2", "Genos2", ["genos2", "genos 2"], true, genosMappings),
  tyros1: profile("tyros1", "Tyros1", ["tyros1", "tyros 1"], false, tyrosMappings),
  tyros2: profile("tyros2", "Tyros2", ["tyros2", "tyros 2"], false, tyrosMappings),
  tyros3: profile("tyros3", "Tyros3", ["tyros3", "tyros 3"], false, tyrosMappings),
  tyros4: profile("tyros4", "Tyros4", ["tyros4", "tyros 4"], false, tyrosMappings),
  tyros5: profile("tyros5", "Tyros5", ["tyros5", "tyros 5"], false, tyrosMappings),
  psr_s750: profile("psr_s750", "PSR-S750", ["psrs750", "psr s750", "s750"], false, tyrosMappings),
  psr_s770: profile("psr_s770", "PSR-S770", ["psrs770", "psr s770", "s770"], false, tyrosMappings),
  psr_s775: profile("psr_s775", "PSR-S775", ["psrs775", "psr s775", "s775"], false, tyrosMappings),
  psr_s900: profile("psr_s900", "PSR-S900", ["psrs900", "psr s900", "s900"], false, tyrosMappings),
  psr_s950: profile("psr_s950", "PSR-S950", ["psrs950", "psr s950", "s950"], false, tyrosMappings),
  psr_s970: profile("psr_s970", "PSR-S970", ["psrs970", "psr s970", "s970"], false, tyrosMappings),
  psr_s975: profile("psr_s975", "PSR-S975", ["psrs975", "psr s975", "s975"], false, tyrosMappings),
  psr_sx700: profile("psr_sx700", "PSR-SX700", ["psrsx700", "psr sx700", "sx700"], false, tyrosMappings),
  psr_sx900: profile("psr_sx900", "PSR-SX900", ["psrsx900", "psr sx900", "sx900"], false, tyrosMappings),
}

/** Prefer more specific tokens first (genos2 before genos, sx900 before s900, etc.). */
const DETECT_ORDER: YamahaModelId[] = [
  "genos2",
  "genos",
  "tyros5",
  "tyros4",
  "tyros3",
  "tyros2",
  "tyros1",
  "psr_sx900",
  "psr_sx700",
  "psr_s975",
  "psr_s970",
  "psr_s950",
  "psr_s900",
  "psr_s775",
  "psr_s770",
  "psr_s750",
]

export function detectProfile(modelName: string): KeyboardProfile | null {
  const normalized = modelName.toLowerCase().replace(/[^a-z0-9]/g, "")
  return (
    DETECT_ORDER.map((id) => KEYBOARD_PROFILES[id]).find((entry) =>
      entry.identityTokens.some((token) =>
        normalized.includes(token.replace(/[^a-z0-9]/g, "")),
      ),
    ) ?? null
  )
}

export function profileFromUniversalIdentity(data: Uint8Array): KeyboardProfile | null {
  if (
    data.length < 10 ||
    data[0] !== 0xf0 ||
    data[1] !== 0x7e ||
    data[3] !== 0x06 ||
    data[4] !== 0x02 ||
    data[5] !== 0x43
  ) {
    return null
  }
  const family = `${data[6]}:${data[7]}`
  const member = `${data[8]}:${data[9]}`
  // Desktop InstrumentController / website Genos identity vectors
  if (family === "0:68" && member === "66:28") return KEYBOARD_PROFILES.genos
  if (family === "127:104") return KEYBOARD_PROFILES.genos2
  if (family === "127:94") return KEYBOARD_PROFILES.genos
  if (family === "127:127") return KEYBOARD_PROFILES.tyros5
  if (family === "127:78") return KEYBOARD_PROFILES.tyros5 // 0x7F4E
  if (family === "127:117") return KEYBOARD_PROFILES.genos // 0x7F75
  if (family === "127:118") return KEYBOARD_PROFILES.genos2 // 0x7F76
  if (family === "127:102") return KEYBOARD_PROFILES.psr_sx900 // 0x7F66
  if (family === "127:103") return KEYBOARD_PROFILES.psr_sx700 // 0x7F67
  return null
}

export const ALL_YAMAHA_MODEL_IDS = DETECT_ORDER
