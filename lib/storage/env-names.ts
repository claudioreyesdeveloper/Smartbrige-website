import { STORAGE_ENV_VAR_NAMES } from "@/lib/storage/config"

/** Documented env var names for operators (no values). */
export function listStorageEnvVarNames(): readonly string[] {
  return STORAGE_ENV_VAR_NAMES
}
