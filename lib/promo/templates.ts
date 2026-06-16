export interface PromoProduct {
  title: string
  image: string
  price?: string | null
}

export interface PromoTemplate {
  id: string
  label: string
  description: string
  caption: (groupName: string, products: PromoProduct[]) => string
}

export const PROMO_TEMPLATES: PromoTemplate[] = [
  {
    id: 'spotlight',
    label: 'Hero Spotlight',
    description: 'One product, front and center.',
    caption: (groupName, products) =>
      `Introducing the ${products[0]?.title ?? 'newest design'} — now available for ${groupName}. Shop the look today.`,
  },
  {
    id: 'grid',
    label: 'Product Grid',
    description: 'Show off the full lineup.',
    caption: (groupName) =>
      `Fresh gear for ${groupName} 🎤 Shop the full collection now.`,
  },
  {
    id: 'dropped',
    label: 'Just Dropped',
    description: 'High-energy new-release announcement.',
    caption: (groupName) =>
      `🔥 Just dropped! New ${groupName} merch is live — grab yours before they're gone.`,
  },
  {
    id: 'limited',
    label: 'Limited Time',
    description: 'Urgency-driven, scarcity messaging.',
    caption: (groupName) =>
      `⏳ Limited time: ${groupName} gear won't be around forever. Get yours now before it's gone.`,
  },
  {
    id: 'heroShelf',
    label: 'Mobile Hero',
    description: 'Full-bleed photo, bold headline, product shelf, and CTA — great for Stories.',
    caption: (groupName, products) =>
      `${products[0]?.title ?? 'New gear'} just dropped for ${groupName} — shop the look now.`,
  },
]

export function getTemplate(id: string): PromoTemplate {
  return PROMO_TEMPLATES.find(t => t.id === id) ?? PROMO_TEMPLATES[0]
}
