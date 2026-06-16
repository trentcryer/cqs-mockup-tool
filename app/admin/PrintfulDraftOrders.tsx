'use client'

import { useState } from 'react'
import type { PrintfulDraftOrder } from '@/lib/printful'

interface Props {
  orders: PrintfulDraftOrder[]
  confirmAction: (orderId: number) => Promise<void>
}

function formatDate(unixTs: number) {
  return new Date(unixTs * 1000).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function OrderCard({ order, onConfirm }: { order: PrintfulDraftOrder; onConfirm: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  async function handleConfirm() {
    setConfirming(true)
    try {
      await onConfirm()
      setConfirmed(true)
    } catch {
      setConfirming(false)
    }
  }

  if (confirmed) return null

  // Prefer the 'preview' file (rendered design on garment); fall back to any file
  const previewFile = order.items[0]?.files.find(f => f.type === 'preview')
    ?? order.items[0]?.files[0]
  const thumbnail = previewFile?.thumbnail_url ?? previewFile?.preview_url

  const profit = order.pricing_breakdown?.[0]?.profit
  const retailTotal = order.retail_costs?.total

  return (
    <div className="card p-4 flex gap-4">
      {/* Design preview thumbnail */}
      <div className="shrink-0">
        {thumbnail ? (
          <img src={thumbnail} alt="design preview"
            className="w-20 h-20 object-cover rounded border border-[#d4c5b0] bg-[#f9f6f0]" />
        ) : (
          <div className="w-20 h-20 rounded border border-[#d4c5b0] bg-[#f9f6f0] flex items-center justify-center text-[10px] text-[#8a7660] text-center px-1">
            no preview
          </div>
        )}
      </div>

      {/* Order info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div>
            <span className="font-medium text-sm">
              {order.recipient.name || 'Customer'}
            </span>
            <span className="text-[#8a7660] text-xs ml-2">
              {order.recipient.city}, {order.recipient.state_code}
            </span>
          </div>
          <span className="text-xs text-[#8a7660] shrink-0">{formatDate(order.created)}</span>
        </div>

        {/* Line items */}
        <div className="space-y-0.5 mb-3">
          {order.items.map(item => (
            <p key={item.id} className="text-xs text-[#6b5f54] truncate">
              {item.quantity > 1 && <span className="font-medium">{item.quantity}× </span>}
              {item.name || item.product.name}
            </p>
          ))}
        </div>

        {/* Footer row */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            {retailTotal && (
              <span className="text-xs font-medium">
                ${parseFloat(retailTotal).toFixed(2)} retail
              </span>
            )}
            {profit && (
              <span className="text-xs text-green-700 font-medium">
                +${parseFloat(profit).toFixed(2)} profit
              </span>
            )}
            <a
              href={order.dashboard_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-[#1c1412] underline underline-offset-2"
            >
              Printful #{order.id}
            </a>
            {order.external_id && (
              <span className="text-[10px] text-[#8a7660]">
                Shopify #{order.external_id}
              </span>
            )}
          </div>

          <button
            onClick={handleConfirm}
            disabled={confirming}
            className="btn-primary text-xs px-3 py-1.5 rounded-lg disabled:opacity-50 shrink-0"
          >
            {confirming ? 'Confirming…' : 'Confirm & Send to Print'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PrintfulDraftOrders({ orders, confirmAction }: Props) {
  const [localOrders, setLocalOrders] = useState(orders)

  async function handleConfirm(orderId: number) {
    await confirmAction(orderId)
    setLocalOrders(prev => prev.filter(o => o.id !== orderId))
  }

  if (localOrders.length === 0) {
    return (
      <p className="text-sm text-[#8a7660]">No draft orders waiting — you're all caught up.</p>
    )
  }

  return (
    <div className="space-y-3">
      {localOrders.map(order => (
        <OrderCard
          key={order.id}
          order={order}
          onConfirm={() => handleConfirm(order.id)}
        />
      ))}
    </div>
  )
}
