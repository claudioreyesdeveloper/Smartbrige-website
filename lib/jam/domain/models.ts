export const SUPPORTED_KEYBOARD_MODELS = [
  "genos",
  "genos2",
  "tyros4",
  "tyros5",
] as const

export type KeyboardModel = (typeof SUPPORTED_KEYBOARD_MODELS)[number]

export function isSupportedKeyboardModel(value: string): value is KeyboardModel {
  return (SUPPORTED_KEYBOARD_MODELS as readonly string[]).includes(value)
}
