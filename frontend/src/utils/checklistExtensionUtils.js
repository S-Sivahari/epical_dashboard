import { EMPTY_CHECKLIST_EXTENSION } from '@/types/projectWorkspace'

export function normalizeChecklistExtension(value) {
  const ext = value ?? EMPTY_CHECKLIST_EXTENSION
  const dimensionX =
    ext.dimensionX != null && Number.isFinite(Number(ext.dimensionX)) ? Number(ext.dimensionX) : null
  const dimensionY =
    ext.dimensionY != null && Number.isFinite(Number(ext.dimensionY)) ? Number(ext.dimensionY) : null

  return {
    dimensionX,
    dimensionY,
    area:
      dimensionX != null && dimensionY != null ? dimensionX * dimensionY : ext.area ?? null,
    highestMetalUsed: String(ext.highestMetalUsed ?? '').trim(),
    virtualConnection: ext.virtualConnection === 'yes' || ext.virtualConnection === 'no' ? ext.virtualConnection : null,
    overallSubstrateContact:
      ext.overallSubstrateContact === 'yes' || ext.overallSubstrateContact === 'no'
        ? ext.overallSubstrateContact
        : null,
    waivableDrcError:
      ext.waivableDrcError === 'yes' || ext.waivableDrcError === 'no' ? ext.waivableDrcError : null,
  }
}

export function isChecklistExtensionComplete(extension) {
  const ext = normalizeChecklistExtension(extension)
  return (
    ext.dimensionX != null &&
    ext.dimensionY != null &&
    ext.highestMetalUsed.length > 0 &&
    ext.virtualConnection != null &&
    ext.overallSubstrateContact != null &&
    ext.waivableDrcError != null
  )
}

export function areTypeChecklistItemsFilled(items = []) {
  if (!items.length) return true
  return items.every((item) => {
    if (!item.response) return false
    if (item.response === 'no' || item.response === 'not_applicable') {
      return Boolean(String(item.comment ?? '').trim())
    }
    return true
  })
}

export function canCompleteCellWithChecklist({
  checklistItems = [],
  mappingFilled = true,
  extension,
} = {}) {
  const hasChecklist = checklistItems.length > 0
  if (!hasChecklist) {
    return { ready: true, message: '' }
  }

  if (!mappingFilled) {
    return { ready: false, message: 'Complete all checklist questions first' }
  }

  if (!areTypeChecklistItemsFilled(checklistItems)) {
    return { ready: false, message: 'Complete all checklist questions first' }
  }

  if (!isChecklistExtensionComplete(extension)) {
    return { ready: false, message: 'Complete the final cell details before marking this cell as completed' }
  }

  return { ready: true, message: '' }
}
