import type { JamPlayerAdapters } from "../types"
import { createFakeCatalogClient, type FakeCatalogOptions } from "./catalog"
import { createFakeConnectionClient, type FakeConnectionOptions } from "./connection"
import { createFakePlanDispatcher, type FakeDispatcherOptions } from "./dispatcher"
import { createFakeEngineClient, type FakeEngineOptions } from "./engine"
import { createFakeProjectSession, type FakeProjectOptions } from "./project"

export { createFakeCatalogClient } from "./catalog"
export { createFakeConnectionClient } from "./connection"
export { createFakePlanDispatcher } from "./dispatcher"
export { createFakeEngineClient } from "./engine"
export { createFakeProjectSession } from "./project"
export { FIXTURE_SONGS, FIXTURE_STYLES, KEY_OPTIONS } from "./fixtures"

export type CreateFakeJamAdaptersOptions = {
  catalog?: FakeCatalogOptions
  engine?: FakeEngineOptions
  dispatcher?: FakeDispatcherOptions
  projects?: FakeProjectOptions
  connection?: FakeConnectionOptions
}

export function createFakeJamAdapters(
  options: CreateFakeJamAdaptersOptions = {},
): JamPlayerAdapters {
  return {
    catalog: createFakeCatalogClient(options.catalog),
    engine: createFakeEngineClient(options.engine),
    dispatcher: createFakePlanDispatcher(options.dispatcher),
    projects: createFakeProjectSession(options.projects),
    connection: createFakeConnectionClient(options.connection),
  }
}
