/**
 * BassMegaVoiceMaps::remapBassVelocitiesForTarget — TypeScript port of
 * SmartBridge/Source/Core/BassMegaVoiceMapsGenerated.cpp
 *
 * Library clips are authored for ElectricBass (reference). When the UI picks
 * another MegaVoice, note-on velocities are remapped into that voice's zones.
 */

import profilesJson from "./bass-megavoice-profiles.json"

export type BassMegaVoiceZone = {
  velLo: number
  velHi: number
  articulation: string
}

export type BassMegaVoiceProfile = {
  displayName: string
  bankMsb: number
  bankLsb: number
  programYamaha: number
  zones: BassMegaVoiceZone[]
}

type ProfilesFile = {
  referenceProfileIndex: number
  profiles: BassMegaVoiceProfile[]
}

const DATA = profilesJson as ProfilesFile

export const BASS_MEGAVOICE_PROFILES: BassMegaVoiceProfile[] = DATA.profiles
export const BASS_REFERENCE_PROFILE_INDEX = DATA.referenceProfileIndex

const NOISE_LANE_NOTE_LO = 84

type SlapOnlyVoice = {
  name: string
  slapLo: number
  slapHi: number
  deadLo: number
  deadHi: number
  harmLo: number
  harmHi: number
  playedBoost: number
  slapAccentTarget: number
}

const SLAP_ONLY_VOICES: SlapOnlyVoice[] = [
  { name: "ElJazzSlapFull", slapLo: 35, slapHi: 55, deadLo: 101, deadHi: 110, harmLo: 121, harmHi: 127, playedBoost: -5, slapAccentTarget: 50 },
  { name: "ElJazzSlapCompatible", slapLo: 1, slapHi: 80, deadLo: 81, deadHi: 120, harmLo: 121, harmHi: 127, playedBoost: 20, slapAccentTarget: 70 },
  { name: "ActiveBassSlap", slapLo: 1, slapHi: 60, deadLo: 65, deadHi: 75, harmLo: 121, harmHi: 127, playedBoost: -10, slapAccentTarget: 57 },
]

const SLAP_ACCENT_OFFSETS: Record<string, number> = {
  ElJazzFingerOpenSlap: 3,
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

export function getBassProfile(index: number): BassMegaVoiceProfile {
  const i = clamp(index, 0, BASS_MEGAVOICE_PROFILES.length - 1)
  return BASS_MEGAVOICE_PROFILES[i]
}

export function findBassProfileIndexByName(name: string): number {
  const want = name.trim().toLowerCase()
  return BASS_MEGAVOICE_PROFILES.findIndex(
    (p) => p.displayName.toLowerCase() === want,
  )
}

export function findBassProfileIndexByBank(
  msb: number,
  lsb: number,
  programYamaha: number,
): number {
  return BASS_MEGAVOICE_PROFILES.findIndex(
    (p) =>
      p.bankMsb === msb &&
      p.bankLsb === lsb &&
      p.programYamaha === programYamaha,
  )
}

/** articulationBucket — open=0, dead=2, slap=3, harmonic=4, mute=5, hammer=6, se=7 */
function articulationBucket(art: string): number {
  const a = art.toLowerCase()
  if (a.includes("hammer")) return 6
  if (a.includes("dead")) return 2
  if (a.includes("mute") || a.includes("muted")) return 5
  if (a.includes("harm")) return 4
  if (a.includes("slap") || a.includes("pull") || a.includes("pop") || a.includes("thumb"))
    return 3
  if (a.includes("se ") || a.startsWith("se") || a.includes("noise") || a.includes("fx"))
    return 7
  return 0 // open / finger / pick
}

function findZoneForVelocity(p: BassMegaVoiceProfile, vel: number): number {
  for (let zi = 0; zi < p.zones.length; zi += 1) {
    if (vel >= p.zones[zi].velLo && vel <= p.zones[zi].velHi) return zi
  }
  return Math.max(0, p.zones.length - 1)
}

function bucketZoneCount(p: BassMegaVoiceProfile, bucket: number): number {
  let n = 0
  for (const z of p.zones) {
    if (articulationBucket(z.articulation) === bucket) n += 1
  }
  return n
}

function zoneOrdinalInBucket(
  p: BassMegaVoiceProfile,
  zi: number,
  bucket: number,
): number {
  let ord = 0
  for (let i = 0; i <= zi && i < p.zones.length; i += 1) {
    if (articulationBucket(p.zones[i].articulation) === bucket) ord += 1
  }
  return Math.max(0, ord - 1)
}

function pickTargetZoneByBucketOrdinal(
  ref: BassMegaVoiceProfile,
  tgt: BassMegaVoiceProfile,
  refZi: number,
  refBucket: number,
  targetBucket: number,
): number {
  const tgtCount = bucketZoneCount(tgt, targetBucket)
  if (tgtCount <= 0) return -1
  const refCount = bucketZoneCount(ref, refBucket)
  const refOrd = zoneOrdinalInBucket(ref, refZi, refBucket)
  let tgtOrd = Math.min(refOrd, tgtCount - 1)
  if (refBucket === 3 && targetBucket === 3 && refCount <= 1 && tgtCount > 1) {
    tgtOrd = tgtCount - 1
  }
  if (refCount > 1 && tgtCount > 1) {
    const alpha = clamp(refOrd / (refCount - 1), 0, 1)
    tgtOrd = Math.round(alpha * (tgtCount - 1))
  }
  let seen = 0
  for (let zi = 0; zi < tgt.zones.length; zi += 1) {
    if (articulationBucket(tgt.zones[zi].articulation) !== targetBucket) continue
    if (seen === tgtOrd) return zi
    seen += 1
  }
  return -1
}

function pickTargetZone(
  ref: BassMegaVoiceProfile,
  tgt: BassMegaVoiceProfile,
  refZi: number,
  bucket: number,
): number {
  const tgtName = tgt.displayName.toLowerCase()
  if (bucket === 0 && refZi >= 1 && tgtName.includes("openslap")) {
    const slapZi = pickTargetZoneByBucketOrdinal(ref, tgt, refZi, bucket, 3)
    if (slapZi >= 0) return slapZi
  }
  let zi = pickTargetZoneByBucketOrdinal(ref, tgt, refZi, bucket, bucket)
  if (zi >= 0) return zi
  if (bucket === 0) {
    zi = pickTargetZoneByBucketOrdinal(ref, tgt, refZi, bucket, 3)
    if (zi >= 0) return zi
  }
  if (bucket === 3) {
    zi = pickTargetZoneByBucketOrdinal(ref, tgt, refZi, bucket, 4)
    if (zi >= 0) return zi
    zi = pickTargetZoneByBucketOrdinal(ref, tgt, refZi, bucket, 0)
    if (zi >= 0) {
      let hottest = zi
      for (let k = zi + 1; k < tgt.zones.length; k += 1) {
        if (articulationBucket(tgt.zones[k].articulation) === 0) hottest = k
      }
      return hottest
    }
  }
  if (bucket === 4) {
    zi = pickTargetZoneByBucketOrdinal(ref, tgt, refZi, bucket, 3)
    if (zi >= 0) return zi
  }
  if (bucket === 5) {
    zi = pickTargetZoneByBucketOrdinal(ref, tgt, refZi, bucket, 0)
    if (zi >= 0) return zi
  }
  let fallbackZi = clamp(refZi, 0, Math.max(0, tgt.zones.length - 1))
  const zb = (idx: number) => articulationBucket(tgt.zones[idx].articulation)
  if (
    tgt.zones.length > 1 &&
    fallbackZi === tgt.zones.length - 1 &&
    zb(fallbackZi) === 7
  ) {
    fallbackZi = Math.max(0, tgt.zones.length - 2)
  }
  return fallbackZi
}

function superBucket(bucket: number): number {
  if (bucket === 3 || bucket === 5) return 0
  return bucket
}

function computeContiguousSuperSpan(
  p: BassMegaVoiceProfile,
  zoneIndex: number,
): { lo: number; hi: number; valid: boolean } {
  if (zoneIndex < 0 || zoneIndex >= p.zones.length) {
    return { lo: 128, hi: 0, valid: false }
  }
  const sb = superBucket(articulationBucket(p.zones[zoneIndex].articulation))
  if (sb < 0) return { lo: 128, hi: 0, valid: false }
  let loZi = zoneIndex
  let hiZi = zoneIndex
  while (loZi > 0) {
    const prev = loZi - 1
    if (superBucket(articulationBucket(p.zones[prev].articulation)) !== sb) break
    if (p.zones[loZi].velLo > p.zones[prev].velHi + 1) break
    loZi = prev
  }
  while (hiZi + 1 < p.zones.length) {
    const next = hiZi + 1
    if (superBucket(articulationBucket(p.zones[next].articulation)) !== sb) break
    if (p.zones[next].velLo > p.zones[hiZi].velHi + 1) break
    hiZi = next
  }
  return {
    lo: p.zones[loZi].velLo,
    hi: p.zones[hiZi].velHi,
    valid: true,
  }
}

function findSlapOnly(p: BassMegaVoiceProfile): SlapOnlyVoice | null {
  return SLAP_ONLY_VOICES.find((s) => s.name === p.displayName) || null
}

/**
 * Remap note-on velocities from ElectricBass reference bands into the target
 * MegaVoice zones. Returns a new velocity for each input note-on velocity
 * (notes ≥ 84 are noise-lane and left unchanged).
 */
export function remapBassVelocityForTarget(
  note: number,
  velocity: number,
  targetProfileIndex: number,
): number {
  if (
    targetProfileIndex < 0 ||
    targetProfileIndex >= BASS_MEGAVOICE_PROFILES.length ||
    targetProfileIndex === BASS_REFERENCE_PROFILE_INDEX
  ) {
    return velocity
  }
  if (note >= NOISE_LANE_NOTE_LO) return velocity
  const v = clamp(Math.round(velocity), 1, 127)
  const REF = getBassProfile(BASS_REFERENCE_PROFILE_INDEX)
  const TGT = getBassProfile(targetProfileIndex)

  const slapOnly = findSlapOnly(TGT)
  if (slapOnly) {
    let nv = v
    if (v >= 81 && v <= 120) {
      const t = clamp((v - 81) / 39, 0, 1)
      nv = Math.round(slapOnly.deadLo + t * (slapOnly.deadHi - slapOnly.deadLo))
      nv = clamp(nv, slapOnly.deadLo, slapOnly.deadHi)
    } else if (v >= 121) {
      nv = slapOnly.slapAccentTarget > 0 ? slapOnly.slapAccentTarget : slapOnly.slapHi
      nv = clamp(nv, slapOnly.slapLo, slapOnly.slapHi)
    } else {
      if (slapOnly.slapLo === 1 && slapOnly.slapHi === 80) nv = v
      else {
        const t = clamp((v - 1) / 79, 0, 1)
        nv = Math.round(slapOnly.slapLo + t * (slapOnly.slapHi - slapOnly.slapLo))
        nv = clamp(nv, slapOnly.slapLo, slapOnly.slapHi)
      }
      if (slapOnly.playedBoost !== 0) {
        nv = clamp(nv + slapOnly.playedBoost, slapOnly.slapLo, slapOnly.slapHi)
      }
    }
    return clamp(nv, 1, 127)
  }

  const refZi = findZoneForVelocity(REF, v)
  const refBucket = articulationBucket(REF.zones[refZi].articulation)
  const tgtZi = pickTargetZone(REF, TGT, refZi, refBucket)
  const refSpan = computeContiguousSuperSpan(REF, refZi)
  const tgtSpan = computeContiguousSuperSpan(TGT, tgtZi)
  if (!refSpan.valid || !tgtSpan.valid) return v
  let nv = v
  if (refSpan.lo !== tgtSpan.lo || refSpan.hi !== tgtSpan.hi) {
    let t = 0.5
    if (refSpan.hi > refSpan.lo) t = (v - refSpan.lo) / (refSpan.hi - refSpan.lo)
    t = clamp(t, 0, 1)
    nv = Math.round(tgtSpan.lo + t * (tgtSpan.hi - tgtSpan.lo))
    nv = clamp(nv, tgtSpan.lo, tgtSpan.hi)
  }
  const slapAccentOffset = SLAP_ACCENT_OFFSETS[TGT.displayName] || 0
  if (refBucket === 3 && slapAccentOffset !== 0) {
    nv = clamp(nv + slapAccentOffset, 1, 127)
  }
  return clamp(nv, 1, 127)
}

export function remapBassNoteVelocitiesForTarget<
  T extends { note: number; velocity: number },
>(notes: T[], targetProfileIndex: number): T[] {
  return notes.map((n) => ({
    ...n,
    velocity: remapBassVelocityForTarget(n.note, n.velocity, targetProfileIndex),
  }))
}

/** Apply desktop applyBassVelocityDelta before remap (sustain 1–80, dead 81–120). */
export function applyBassVelocityDeltas(
  velocity: number,
  sustainDelta: number,
  deadDelta: number,
): number {
  const v = clamp(Math.round(velocity), 1, 127)
  if (v >= 1 && v <= 80) return clamp(v + sustainDelta, 1, 80)
  if (v >= 81 && v <= 120) return clamp(v + deadDelta, 81, 120)
  return v
}
