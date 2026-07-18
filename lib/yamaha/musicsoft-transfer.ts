import type { TransferProgress } from "@/lib/yamaha/types"
import type { YamahaMidiSession } from "@/lib/yamaha/midi-session"
import {
  ascii,
  checksum7,
  data7,
  decodePayload7,
  encodePayload7,
  startsWithBytes,
  text,
} from "@/lib/yamaha/protocol-utils"

const frame = (body: number[]) => Uint8Array.from([0xf0, ...body, 0xf7])
const reply = (...prefix: number[]) => (data: Uint8Array) => startsWithBytes(data, prefix)
const ACK = reply(0xf0, 0x43, 0x50, 0x00, 0x03, 0x00)
const CHUNK_SIZE = 210

export class MusicsoftTransfer {
  constructor(
    private readonly session: YamahaMidiSession,
    private readonly progress: (update: TransferProgress) => void = () => {},
  ) {}

  private emit(phase: TransferProgress["phase"], percent: number, message: string) {
    this.progress({ phase, percent, message })
  }

  private async requestAny(data: Uint8Array) {
    try {
      await this.session.request(data, () => true, 900)
    } catch {
      // Musicsoft preamble probes are acknowledged silently by some models.
    }
  }

  async initialize(): Promise<{ driveIndex: number; modelName: string }> {
    this.emit("detecting", 3, "Reading the Yamaha model")
    const modelReply = await this.session.request(
      frame([0x43, 0x50, 0x00, 0x00, 0x07, 0x01]),
      reply(0xf0, 0x43, 0x50, 0x00, 0x00, 0x07, 0x02),
    )
    const modelName = text(decodePayload7(modelReply.slice(8, -1)))

    this.emit("initializing", 8, "Opening Musicsoft transfer mode")
    const initReply = await this.session.request(
      frame([0x43, 0x50, 0x00, 0x00, 0x00, 0x01]),
      reply(0xf0, 0x43, 0x50, 0x00, 0x00, 0x00, 0x02, 0x01),
    )
    const driveCount = initReply[8] || 1
    await this.requestAny(frame([0x43, 0x50, 0x00, 0x00, 0x02, 0x01]))
    await this.session.request(
      frame([0x43, 0x50, 0x00, 0x00, 0x01, 0x01]),
      reply(0xf0, 0x43, 0x50, 0x00, 0x00, 0x01, 0x02, 0x00),
    )
    await this.session.request(
      frame([0x43, 0x50, 0x00, 0x00, 0x01, 0x00, 0x01]),
      reply(0xf0, 0x43, 0x50, 0x00, 0x00, 0x01, 0x02, 0x01),
    )
    await this.requestAny(frame([0x43, 0x50, 0x00, 0x05, 0x0b, 0x00, 0x00]))
    await this.requestAny(frame([0x43, 0x50, 0x00, 0x05, 0x06, 0x00, 0x00]))

    this.emit("scanning", 14, "Finding USER:\\STYLE")
    for (let index = 0; index < Math.max(1, driveCount); index += 1) {
      const name = await this.getDriveName(index)
      if (name.toUpperCase() === "USER") return { driveIndex: index, modelName }
    }
    throw new Error("The keyboard did not expose a USER drive.")
  }

  private async getDriveName(index: number): Promise<string> {
    const response = await this.session.request(
      frame([0x43, 0x50, 0x00, 0x05, 0x0b, 0x00, index & 0x7f]),
      reply(0xf0, 0x43, 0x50, 0x00, 0x05, 0x0b, 0x01),
    )
    return text(decodePayload7(response.slice(11, -1)))
  }

  async uploadFile(remotePath: string, bytes: Uint8Array, percentRange: [number, number]) {
    if (!bytes.length) throw new Error("Cannot transfer an empty file.")
    const encodedPath = encodePayload7(ascii(remotePath, true))
    const open = frame([
      0x43,
      0x50,
      0x00,
      0x06,
      0x01,
      0x00,
      0x05,
      ...data7(bytes.length, 5),
      0x05,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      ...data7(encodedPath.length, 2),
      ...encodedPath,
    ])
    await this.session.request(open, ACK)

    const chunks = Math.ceil(bytes.length / CHUNK_SIZE)
    for (let index = 0; index < chunks; index += 1) {
      const chunk = bytes.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE)
      const inner = Uint8Array.from([0x02, 0x02, index % 128, ...encodePayload7(chunk)])
      const packet = frame([
        0x43,
        0x50,
        0x01,
        ...data7(inner.length, 2),
        ...inner,
        checksum7(inner),
      ])
      await this.session.request(packet, ACK)
      const fraction = (index + 1) / chunks
      const percent = percentRange[0] + (percentRange[1] - percentRange[0]) * fraction
      this.emit("uploading", percent, `Sending chunk ${index + 1} of ${chunks}`)
    }

    await this.session.request(
      frame([0x43, 0x50, 0x00, 0x03, 0x02]),
      reply(0xf0, 0x43, 0x50, 0x00, 0x03, 0x03),
    )
  }

  async listFiles(pathPattern: string): Promise<string[]> {
    const encodedPath = encodePayload7(ascii(pathPattern, true))
    const first = frame([
      0x43,
      0x50,
      0x00,
      0x05,
      0x04,
      0x00,
      0x3f,
      ...data7(encodedPath.length, 2),
      ...encodedPath,
    ])
    const next = frame([0x43, 0x50, 0x00, 0x05, 0x05, 0x00])
    const matcher = reply(0xf0, 0x43, 0x50, 0x00, 0x05)
    const names: string[] = []
    let response = await this.session.request(first, matcher)
    while (response.length > 27) {
      const start = 23 + response[22] + 2
      if (start >= response.length - 1) break
      const name = text(decodePayload7(response.slice(start, -1)))
      if (name && name !== ".") names.push(name)
      response = await this.session.request(next, matcher)
    }
    return names
  }

  async finish() {
    await this.session.request(
      frame([0x43, 0x50, 0x00, 0x00, 0x01, 0x00, 0x00]),
      reply(0xf0, 0x43, 0x50, 0x00, 0x00, 0x01, 0x02, 0x00),
    )
  }

  async transferStyle(bytes: Uint8Array, fileName = "SmartBridgeDemo.prs") {
    const { driveIndex, modelName } = await this.initialize()
    const root = `${driveIndex}:\\STYLE`
    const entries = await this.listFiles(`${driveIndex}:\\*.*`)
    if (!entries.some((entry) => entry.toUpperCase() === "STYLE")) {
      await this.finish()
      throw new Error("The USER drive has no STYLE folder.")
    }

    const stem = fileName.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_")
    const extension = fileName.match(/\.[^.]+$/)?.[0] || ".prs"
    const uniqueName = `${stem}_${Date.now().toString(36)}${extension}`
    const remotePath = `${root}\\${uniqueName}`
    await this.uploadFile(remotePath, bytes, [18, 82])
    await this.finish()
    return { modelName, driveIndex, remotePath, displayPath: `USER:\\STYLE\\${uniqueName}` }
  }
}

export { CHUNK_SIZE as MUSICSOFT_CHUNK_SIZE }
