export default function AdminLoading() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-12 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-3 w-24 bg-[#d4c5b0] rounded" />
          <div className="h-10 w-64 bg-[#d4c5b0] rounded" />
          <div className="h-4 w-96 bg-[#e5ddd2] rounded" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-28 bg-[#d4c5b0] rounded-xl" />
          <div className="h-10 w-36 bg-[#e5ddd2] rounded-xl" />
          <div className="h-10 w-44 bg-[#e5ddd2] rounded-xl" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="h-7 w-36 bg-[#d4c5b0] rounded" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card p-4 flex gap-4">
            <div className="w-20 h-20 bg-[#e5ddd2] rounded shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-48 bg-[#d4c5b0] rounded" />
              <div className="h-3 w-32 bg-[#e5ddd2] rounded" />
              <div className="h-3 w-24 bg-[#e5ddd2] rounded" />
            </div>
            <div className="w-32 space-y-2">
              <div className="h-8 bg-[#e5ddd2] rounded" />
              <div className="h-8 bg-[#e5ddd2] rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
