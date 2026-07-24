import type { StyleWireMapping, YamahaModelId } from "@/lib/demo/types"
import { ARRANGER_COMMANDS, styleSelectCommand } from "@/lib/demo/yamaha/commands"
import type { YamahaMidiSession } from "@/lib/demo/yamaha/midi-session"

/**
 * Push a factory preset style to the keyboard.
 * Matches desktop JamPlayerScreen::sendKeyboardPresetStyleFromDatabaseRow:
 * Genos2 gets Style Stop before the preset-select SysEx.
 */
export function sendPresetStyleSelect(
  session: YamahaMidiSession,
  mapping: StyleWireMapping,
  modelId?: YamahaModelId | string | null,
): void {
  const id = (modelId || "").toLowerCase()
  if (id === "genos2") {
    session.sendBoth(ARRANGER_COMMANDS.stop)
  }
  session.sendBoth(styleSelectCommand(mapping))
}
