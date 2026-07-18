import type {
  KeyboardProfile,
  StyleGenre,
  StyleWireMapping,
  YamahaModelId,
} from "@/lib/yamaha/types"

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

export const KEYBOARD_PROFILES: Record<YamahaModelId, KeyboardProfile> = {
  genos: {
    id: "genos",
    displayName: "Genos",
    identityTokens: ["genos", "genos1"],
    oneClickActivation: true,
    styleMappings: genosMappings,
  },
  genos2: {
    id: "genos2",
    displayName: "Genos2",
    identityTokens: ["genos2", "genos 2"],
    oneClickActivation: true,
    styleMappings: genosMappings,
  },
  tyros4: {
    id: "tyros4",
    displayName: "Tyros4",
    identityTokens: ["tyros4", "tyros 4"],
    oneClickActivation: false,
    styleMappings: tyrosMappings,
  },
  tyros5: {
    id: "tyros5",
    displayName: "Tyros5",
    identityTokens: ["tyros5", "tyros 5"],
    oneClickActivation: false,
    styleMappings: tyrosMappings,
  },
}

export function detectProfile(modelName: string): KeyboardProfile | null {
  const normalized = modelName.toLowerCase().replace(/[^a-z0-9]/g, "")
  const ordered: YamahaModelId[] = ["genos2", "genos", "tyros5", "tyros4"]
  return (
    ordered
      .map((id) => KEYBOARD_PROFILES[id])
      .find((profile) =>
        profile.identityTokens.some((token) =>
          normalized.includes(token.replace(/[^a-z0-9]/g, "")),
        ),
      ) ?? null
  )
}

/**
 * Universal Identity Reply (F0 7E … 06 02 43 …) profile mapping.
 * Verified tuples from YamahaIdentityCatalog / KeyboardIdentifier.
 */
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
  if (family === "0:68" && member === "66:28") return KEYBOARD_PROFILES.genos
  if (family === "127:104") return KEYBOARD_PROFILES.genos2
  if (family === "127:94") return KEYBOARD_PROFILES.genos
  if (family === "127:127") return KEYBOARD_PROFILES.tyros5
  return null
}

export const UNIVERSAL_IDENTITY_REQUEST = Uint8Array.from([
  0xf0, 0x7e, 0x7f, 0x06, 0x01, 0xf7,
])

export const MUSICSOFT_MODEL_REQUEST = Uint8Array.from([
  0xf0, 0x43, 0x50, 0x00, 0x00, 0x07, 0x01, 0xf7,
])

export function isUniversalIdentityReply(data: Uint8Array): boolean {
  return data[0] === 0xf0 && data[1] === 0x7e && data[3] === 0x06 && data[4] === 0x02
}

export function isMusicsoftModelReply(data: Uint8Array): boolean {
  return (
    data[0] === 0xf0 &&
    data[1] === 0x43 &&
    data[2] === 0x50 &&
    data[3] === 0x00 &&
    data[4] === 0x00 &&
    data[5] === 0x07 &&
    data[6] === 0x02
  )
}
