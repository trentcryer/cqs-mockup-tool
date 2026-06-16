// Ported verbatim (pure math, no DOM) from app/studio/editor/StudioEditorClient.tsx
// so mobile and web produce byte-identical transform objects for the same slider state.

export interface EditorTransform {
  normLeft: number
  normTop: number
  normWidth: number
  normHeight: number
  angle: number
  opacity: number
}

export interface SliderState {
  centerX: number   // 0-100
  centerY: number   // 0-100
  logoSize: number  // 0-100 (or up to 150 for AOP)
  logoAspect: number
}

export function buildTransform({ centerX, centerY, logoSize, logoAspect }: SliderState): EditorTransform {
  const normWidth = Math.min(logoSize / 100, 1)
  const normHeight = normWidth * logoAspect
  const availW = Math.max(0, 1 - normWidth)
  const availH = Math.max(0, 1 - normHeight)
  const normLeft = (centerX / 100) * availW
  const normTop = (centerY / 100) * availH
  return { normLeft, normTop, normWidth, normHeight, angle: 0, opacity: 1 }
}

// Inverse of buildTransform — reconstructs slider positions from a saved transform
// when opening an existing design for editing.
export function initFromTransform(t: Partial<EditorTransform> | null | undefined): SliderState {
  const normW = t?.normWidth || 0.25
  const normH = t?.normHeight || normW
  const availW = Math.max(0.001, 1 - normW)
  const availH = Math.max(0.001, 1 - normH)
  const centerX = t?.normLeft !== undefined ? Math.round((t.normLeft / availW) * 100) : 50
  const centerY = t?.normTop !== undefined ? Math.round((t.normTop / availH) * 100) : 40
  const logoSize = Math.round(normW * 100)
  const logoAspect = t?.normHeight && t?.normWidth ? t.normHeight / t.normWidth : 1
  return { centerX, centerY, logoSize, logoAspect }
}

export interface PrintfulTemplate {
  template_id: number
  image_url: string
  background_url: string | null
  background_color: string | null
  template_width: number
  template_height: number
  print_area_width: number
  print_area_height: number
  print_area_top: number
  print_area_left: number
  printfile_id: number
}

export interface PrintfulTemplatesResponse {
  templates: PrintfulTemplate[]
  variant_mapping: Array<{ variant_id: number; templates: Array<{ placement: string; template_id: number }> }>
}

export function findTemplate(
  resp: PrintfulTemplatesResponse,
  placement: string,
  variantIds: number[]
): PrintfulTemplate | null {
  const { templates, variant_mapping } = resp
  if (!templates?.length) return null
  for (const vm of variant_mapping || []) {
    if (variantIds.includes(vm.variant_id)) {
      const ref = vm.templates?.find(t => t.placement === placement)
      if (ref) {
        const found = templates.find(t => t.template_id === ref.template_id)
        if (found) return found
      }
    }
  }
  return templates[0] ?? null
}
