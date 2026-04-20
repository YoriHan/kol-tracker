import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <h2 className="text-xl font-semibold">找不到该红人</h2>
      <p className="text-sm text-gray-500">该红人不存在或已被删除。</p>
      <Link
        href="/influencers"
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
      >
        返回红人库
      </Link>
    </div>
  )
}
