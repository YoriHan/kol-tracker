export default function InfluencersLoading() {
  return (
    <div className="flex flex-col h-full animate-pulse">
      {/* Header skeleton */}
      <div className="px-6 py-4 border-b bg-white flex items-center gap-3">
        <div className="h-6 w-20 bg-gray-200 rounded mr-auto" />
        <div className="h-9 w-56 bg-gray-100 rounded-md" />
        <div className="h-9 w-28 bg-gray-100 rounded-md" />
        <div className="h-9 w-24 bg-gray-100 rounded-md" />
        <div className="h-9 w-20 bg-gray-100 rounded-md" />
        <div className="h-9 w-20 bg-gray-100 rounded-md" />
        <div className="h-9 w-24 bg-gray-200 rounded-md" />
      </div>
      <div className="px-6 py-2 border-b bg-white h-9" />
      {/* Table rows skeleton */}
      <div className="flex-1 bg-white">
        <div className="border-b px-4 py-3 flex gap-4">
          {[3, 20, 12, 10, 14, 12, 14].map((w, i) => (
            <div key={i} className={`h-3 bg-gray-200 rounded w-${w}`} />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="border-b px-4 py-3 flex items-center gap-4">
            <div className="h-4 w-4 bg-gray-100 rounded" />
            <div className="h-8 w-8 bg-gray-200 rounded-full shrink-0" />
            <div className="h-4 w-32 bg-gray-200 rounded" />
            <div className="h-4 w-16 bg-gray-100 rounded" />
            <div className="h-5 w-20 bg-gray-100 rounded-full" />
            <div className="h-4 w-20 bg-gray-100 rounded" />
            <div className="h-4 w-24 bg-gray-100 rounded" />
            <div className="h-4 w-20 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
