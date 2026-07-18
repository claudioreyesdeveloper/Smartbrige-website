/**
 * Browser-side MIDI send interceptor for Playwright protocol tests.
 * Injected via page.addInitScript — every MIDIOutput.send is recorded.
 */

export type CapturedMidiSend = {
  index: number
  t: number
  port: string
  bytes: number[]
  hex: string
}

export const MIDI_CAPTURE_INIT = `
(() => {
  const midiWindow = window;
  midiWindow.__midiSends = [];
  midiWindow.__midiCaptureStart = 0;
  midiWindow.__midiActionMarks = [];

  const toHex = (bytes) =>
    Array.from(bytes, (b) => b.toString(16).padStart(2, "0").toUpperCase()).join(" ");

  const pushSend = (port, data) => {
    const bytes = Array.from(data instanceof Uint8Array ? data : new Uint8Array(data));
    midiWindow.__midiSends.push({
      index: midiWindow.__midiSends.length,
      t: performance.now() - (midiWindow.__midiCaptureStart || performance.now()),
      port,
      bytes,
      hex: toHex(bytes),
    });
  };

  const makePort = (id, name) => ({
    id,
    name,
    manufacturer: "Yamaha",
    state: "connected",
    onmidimessage: null,
    open: async () => {},
    close: async () => {},
    send: (data) => pushSend(name, data),
  });

  const input1 = makePort("yamaha-in-1", "Digital Keyboard Port 1");
  const input2 = makePort("yamaha-in-2", "Digital Keyboard Port 2");
  const output1 = makePort("yamaha-out-1", "Digital Keyboard Port 1");
  const output2 = makePort("yamaha-out-2", "Digital Keyboard Port 2");

  const replyOn = (input, data) => {
    setTimeout(() => input.onmidimessage?.({ data: Uint8Array.from(data) }), 0);
  };

  const handleOutgoing = (portName, data) => {
    pushSend(portName, data);
    const bytes = Array.from(data instanceof Uint8Array ? data : new Uint8Array(data));
    const key = bytes.join(",");

    // Universal identity request (detectKeyboard first attempt) — both ports.
    // Reply uses KeyboardIdentifier family 0x7F68 (Genos2) — catalog-verified only.
    // Do NOT invent Tyros4 / unverified member bytes.
    if (key === "240,126,127,6,1,247") {
      replyOn(input1, [
        0xf0, 0x7e, 0x7f, 0x06, 0x02, 0x43, 0x7f, 0x68, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xf7,
      ]);
      return;
    }

    // Musicsoft model query — Port 1 only (midi-session detectKeyboard fallback + transfer).
    if (key === "240,67,80,0,0,7,1,247") {
      replyOn(input1, [
        0xf0, 0x43, 0x50, 0, 0, 7, 2, 0,
        0, 71, 101, 110, 111, 115, 50, 0xf7,
      ]);
      return;
    }

    // Musicsoft init / drive / path handshake replies used by MusicsoftTransfer.
    if (key.startsWith("240,67,80,0,0,0,1")) {
      replyOn(input1, [0xf0, 0x43, 0x50, 0, 0, 0, 2, 1, 1, 0xf7]);
      return;
    }
    if (key === "240,67,80,0,0,2,1,247") {
      replyOn(input1, [0xf0, 0x43, 0x50, 0, 3, 0, 0xf7]);
      return;
    }
    if (key === "240,67,80,0,0,1,1,247") {
      replyOn(input1, [0xf0, 0x43, 0x50, 0, 0, 1, 2, 0, 0xf7]);
      return;
    }
    if (key.startsWith("240,67,80,0,0,1,0,1")) {
      replyOn(input1, [0xf0, 0x43, 0x50, 0, 0, 1, 2, 1, 0xf7]);
      return;
    }
    if (key.startsWith("240,67,80,0,0,1,0,0")) {
      replyOn(input1, [0xf0, 0x43, 0x50, 0, 0, 1, 2, 0, 0xf7]);
      return;
    }
    // Drive name USER
    if (key.startsWith("240,67,80,0,5,11,0,")) {
      replyOn(input1, [
        0xf0, 0x43, 0x50, 0, 5, 11, 1, 0, 0, 0, 0,
        0, 85, 83, 69, 82, 0, 0xf7,
      ]);
      return;
    }
    if (key.startsWith("240,67,80,0,5,6,0,")) {
      replyOn(input1, [0xf0, 0x43, 0x50, 0, 3, 0, 0xf7]);
      return;
    }
    // listFiles first page (0x05 0x04): one STYLE entry.
    // Parser: start = 23 + response[22] + 2, then decodePayload7(slice(start,-1)).
    // See musicsoft-transfer.ts:listFiles — do not invent layout beyond that.
    if (key.startsWith("240,67,80,0,5,4,")) {
      replyOn(input1, [
        0xf0, 0x43, 0x50, 0, 5, 4, 1,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // indices 7–21
        0, // [22] meta length
        0, 0, // [23],[24] skipped by +2
        0, 83, 84, 89, 76, 69, 0, // encodePayload7("STYLE\\0") at [25…]
        0xf7,
      ]);
      return;
    }
    // listFiles next page (0x05 0x05): short frame ends the while (length > 27) loop.
    if (key.startsWith("240,67,80,0,5,5,")) {
      replyOn(input1, [0xf0, 0x43, 0x50, 0, 5, 5, 1, 0xf7]);
      return;
    }
    // File open / chunk ACK
    if (key.startsWith("240,67,80,0,6,1,") || key.startsWith("240,67,80,1,")) {
      replyOn(input1, [0xf0, 0x43, 0x50, 0, 3, 0, 0xf7]);
      return;
    }
    if (key === "240,67,80,0,3,2,247") {
      replyOn(input1, [0xf0, 0x43, 0x50, 0, 3, 3, 0xf7]);
      return;
    }
  };

  output1.send = (data) => handleOutgoing(output1.name, data);
  output2.send = (data) => handleOutgoing(output2.name, data);

  Object.defineProperty(navigator, "requestMIDIAccess", {
    configurable: true,
    value: async () => ({
      inputs: new Map([
        [input1.id, input1],
        [input2.id, input2],
      ]),
      outputs: new Map([
        [output1.id, output1],
        [output2.id, output2],
      ]),
      onstatechange: null,
    }),
  });

  midiWindow.__midiMark = (action) => {
    midiWindow.__midiActionMarks.push({
      action,
      atIndex: midiWindow.__midiSends.length,
      t: performance.now() - (midiWindow.__midiCaptureStart || performance.now()),
    });
  };
  midiWindow.__midiReset = () => {
    midiWindow.__midiSends = [];
    midiWindow.__midiActionMarks = [];
    midiWindow.__midiCaptureStart = performance.now();
  };
})();
`

export type ActionMark = { action: string; atIndex: number; t: number }

export async function resetMidiCapture(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __midiReset?: () => void }
    w.__midiReset?.()
  })
}

export async function markAction(page: import("@playwright/test").Page, action: string) {
  await page.evaluate((name) => {
    const w = window as unknown as { __midiMark?: (a: string) => void }
    w.__midiMark?.(name)
  }, action)
}

export async function readMidiCapture(page: import("@playwright/test").Page): Promise<{
  sends: CapturedMidiSend[]
  marks: ActionMark[]
}> {
  return page.evaluate(() => {
    const w = window as unknown as {
      __midiSends: CapturedMidiSend[]
      __midiActionMarks: ActionMark[]
    }
    return {
      sends: w.__midiSends || [],
      marks: w.__midiActionMarks || [],
    }
  })
}

export function sliceAction(
  sends: CapturedMidiSend[],
  marks: ActionMark[],
  action: string,
  nextAction?: string,
): CapturedMidiSend[] {
  const start = marks.find((mark) => mark.action === action)
  if (!start) return []
  const end = nextAction
    ? marks.find((mark) => mark.action === nextAction && mark.atIndex >= start.atIndex)
    : marks.find((mark) => mark.atIndex > start.atIndex && mark.action !== action)
  const from = start.atIndex
  const to = end ? end.atIndex : sends.length
  return sends.slice(from, to)
}
