import type { JamConnectionClient, JamConnectionState, YamahaModelId } from "../types"

export type FakeConnectionOptions = {
  browserSupported?: boolean
  connected?: boolean
  model?: YamahaModelId
  displayName?: string
}

function buildState(options: FakeConnectionOptions): JamConnectionState {
  const browserSupported = options.browserSupported ?? true
  const connected = browserSupported && (options.connected ?? true)
  const model = connected ? (options.model ?? "genos") : null
  const displayName = connected
    ? (options.displayName ?? "Yamaha Genos")
    : null

  let guidance: string
  if (!browserSupported) {
    guidance =
      "Open SmartBridge in Google Chrome or Microsoft Edge on a computer, then reconnect your keyboard with USB."
  } else if (!connected) {
    guidance =
      "Connect your Yamaha Genos, Genos2, Tyros4, or Tyros5 with a USB cable, then click Refresh connection."
  } else {
    guidance = `${displayName} connected. You can prepare and play arrangements.`
  }

  return { browserSupported, connected, model, displayName, guidance }
}

export function createFakeConnectionClient(
  options: FakeConnectionOptions = {},
): JamConnectionClient {
  let state = buildState(options)
  const listeners = new Set<(state: JamConnectionState) => void>()

  const emit = () => {
    for (const listener of listeners) listener({ ...state })
  }

  return {
    getState() {
      return { ...state }
    },

    subscribe(listener) {
      listeners.add(listener)
      listener({ ...state })
      return () => listeners.delete(listener)
    },

    async refresh() {
      state = buildState({
        browserSupported: state.browserSupported,
        connected: options.connected ?? state.connected,
        model: options.model ?? state.model ?? undefined,
        displayName: options.displayName ?? state.displayName ?? undefined,
      })
      emit()
    },
  }
}
