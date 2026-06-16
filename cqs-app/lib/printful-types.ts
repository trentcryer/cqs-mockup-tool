export interface ProductDetails {
  id: number
  title: string
  introParagraphs: string[]
  bullets: string[]
  sizes: string[]
  sizeTables: Array<{
    type: string
    unit: string
    measurements: Array<{
      type_label: string
      values: Array<{ size: string; value?: string; min_value?: string; max_value?: string }>
    }>
  }>
}

export interface ColorImage {
  name: string
  code: string
  image: string
}

export interface ProductMeta {
  product: { id: number; title: string; variants: Array<{ id: number; color?: string }> }
  colorMap: Record<string, number[]>
  placements: { key: string; label: string }[]
  printfiles: { available_placements: Record<string, string> }
}
