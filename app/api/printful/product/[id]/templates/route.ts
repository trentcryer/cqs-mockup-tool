import { NextRequest, NextResponse } from 'next/server'
import { getPrintfulClient } from '@/lib/printful'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const client = getPrintfulClient()
    const templates = await client.getTemplates(parseInt(id))
    return NextResponse.json(templates)
  } catch (e: any) {
    return NextResponse.json({ templates: [], variant_mapping: [] })
  }
}
