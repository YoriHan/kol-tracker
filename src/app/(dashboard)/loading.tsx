export default function DashboardLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="h-7 w-24 bg-gray-200 rounded" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg border p-4 flex items-center gap-3">
            <div className="h-10 w-10 bg-gray-200 rounded-lg shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-6 w-12 bg-gray-200 rounded" />
              <div className="h-3 w-16 bg-gray-100 rounded" />
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg border p-4 text-center space-y-2">
            <div className="h-8 w-8 bg-gray-200 rounded mx-auto" />
            <div className="h-3 w-12 bg-gray-100 rounded mx-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}
