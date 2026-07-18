import {
  JAM_CATALOG_DEFAULT_PAGE_SIZE,
  JAM_CATALOG_MAX_PAGE_SIZE,
} from "@/lib/jam/catalog/constants"
import { JamCatalogError } from "@/lib/jam/catalog/errors"
import type { JamCatalogPage } from "@/lib/jam/catalog/types"

function normalizePageSize(pageSize: number | undefined): number {
  const value = pageSize ?? JAM_CATALOG_DEFAULT_PAGE_SIZE
  if (!Number.isInteger(value) || value < 1) {
    throw new JamCatalogError("validation", "pageSize must be a positive integer.")
  }
  if (value > JAM_CATALOG_MAX_PAGE_SIZE) {
    throw new JamCatalogError(
      "limit_exceeded",
      `pageSize exceeds limit ${JAM_CATALOG_MAX_PAGE_SIZE}.`,
    )
  }
  return value
}

function normalizePage(page: number | undefined): number {
  const value = page ?? 1
  if (!Number.isInteger(value) || value < 1) {
    throw new JamCatalogError("validation", "page must be a positive integer.")
  }
  return value
}

export function paginateItems<T>(
  items: readonly T[],
  options?: { page?: number; pageSize?: number },
): JamCatalogPage<T> {
  const page = normalizePage(options?.page)
  const pageSize = normalizePageSize(options?.pageSize)
  const total = items.length
  const start = (page - 1) * pageSize
  const pageItems = start >= total ? [] : items.slice(start, start + pageSize)
  return {
    items: pageItems,
    total,
    page,
    pageSize,
    hasMore: start + pageSize < total,
  }
}

export function matchesSearch(haystack: string, search: string | undefined): boolean {
  if (!search || !search.trim()) return true
  return haystack.toLowerCase().includes(search.trim().toLowerCase())
}
