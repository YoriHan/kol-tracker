export default function InfluencerDetailLoading() {
  return (
    <div className="flex flex-col h-full animate-pulse">
      {/* Back + header */}
      <div className="px-6 py-4 border-b bg-white flex items-center gap-4">
        <div className="h-4 w-16 bg-gray-200 rounded" />
        <div className="h-8 w-8 bg-gray-200 rounded-full" />
        <div className="space-y-1.5">
          <div className="h-5 w-40 bg-gray-200 rounded" />
          <div className="h-3 w-24 bg-gray-100 rounded" />
        </div>
        <div className="ml-auto h-6 w-20 bg-gray-100 rounded-full" />
      </div>
      {/* Tabs */}
      <div className="px-6 pt-4 border-b bg-white flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 w-20 bg-gray-100 rounded-t" />
        ))}
      </div>
      {/* Content */}
      <div className="p-6 space-y-4 flex-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="h-4 w-20 bg-gray-200 rounded shrink-0" />
            <div className="h-8 flex-1 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
