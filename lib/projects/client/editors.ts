import {
  cloneProjectDocument,
  type ProjectBlobRef,
  type ProjectDocument,
  type ProjectRecipe,
} from "@/lib/projects/document"

function withClone(document: ProjectDocument): ProjectDocument {
  return cloneProjectDocument(document)
}

export function setBassRecipe(
  document: ProjectDocument,
  recipe: ProjectRecipe | null | undefined,
): ProjectDocument {
  const next = withClone(document)
  if (recipe == null) {
    delete next.bass
  } else {
    next.bass = { ...recipe }
  }
  return next
}

export function setDrumsRecipe(
  document: ProjectDocument,
  recipe: ProjectRecipe | null | undefined,
): ProjectDocument {
  const next = withClone(document)
  if (recipe == null) {
    delete next.drums
  } else {
    next.drums = { ...recipe }
  }
  return next
}

export function setRecipeRenderBlobId(
  document: ProjectDocument,
  part: "bass" | "drums",
  renderBlobId: string | null | undefined,
): ProjectDocument {
  const next = withClone(document)
  const recipe = next[part]
  if (!recipe) {
    throw new Error(`Cannot set render blob: ${part} recipe is missing.`)
  }
  if (renderBlobId == null || renderBlobId === "") {
    delete recipe.renderBlobId
  } else {
    recipe.renderBlobId = renderBlobId
  }
  return next
}

export function setBlobReferences(
  document: ProjectDocument,
  blobs: ProjectBlobRef[] | null | undefined,
): ProjectDocument {
  const next = withClone(document)
  if (blobs == null) {
    delete next.blobs
  } else {
    next.blobs = blobs.map((blob) => ({ ...blob }))
  }
  return next
}

export function upsertBlobReference(
  document: ProjectDocument,
  ref: ProjectBlobRef,
): ProjectDocument {
  const next = withClone(document)
  const blobs = [...(next.blobs ?? [])]
  const index = blobs.findIndex((item) => item.blobReferenceId === ref.blobReferenceId)
  if (index >= 0) {
    blobs[index] = { ...ref }
  } else {
    blobs.push({ ...ref })
  }
  next.blobs = blobs
  return next
}

export function removeBlobReference(
  document: ProjectDocument,
  blobReferenceId: string,
): ProjectDocument {
  const next = withClone(document)
  const blobs = (next.blobs ?? []).filter((item) => item.blobReferenceId !== blobReferenceId)
  if (blobs.length === 0) {
    delete next.blobs
  } else {
    next.blobs = blobs
  }
  return next
}

export function setSongTitle(document: ProjectDocument, title: string): ProjectDocument {
  const next = withClone(document)
  next.song.title = title.trim() || "Untitled"
  return next
}
