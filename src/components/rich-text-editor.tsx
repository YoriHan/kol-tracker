'use client'

import { useRef, useEffect } from 'react'
import { Bold, Italic, List } from 'lucide-react'

interface RichTextEditorProps {
  value: string | null
  onChange: (html: string | null) => void
  className?: string
  rows?: number
}

export function RichTextEditor({ value, onChange, className, rows = 3 }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const lastHtmlRef = useRef<string>('')

  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    const incoming = value ?? ''
    if (incoming !== lastHtmlRef.current) {
      el.innerHTML = incoming
      lastHtmlRef.current = incoming
    }
  }, [value])

  function handleInput() {
    const el = editorRef.current
    if (!el) return
    const html = el.innerHTML
    lastHtmlRef.current = html
    const result = html === '' || html === '<br>' ? null : html
    onChange(result)
  }

  function execCmd(cmd: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(document as any).execCommand(cmd, false, undefined)
    editorRef.current?.focus()
    handleInput()
  }

  const minH = `${rows * 24 + 16}px`

  return (
    <div className={`border border-gray-200 rounded overflow-hidden ${className ?? ''}`}>
      <div className="flex items-center gap-0.5 px-2 py-1 border-b bg-gray-50">
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); execCmd('bold') }}
          className="p-1 rounded hover:bg-gray-200 text-gray-600"
          title="加粗 (Ctrl+B)"
        >
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); execCmd('italic') }}
          className="p-1 rounded hover:bg-gray-200 text-gray-600"
          title="斜体 (Ctrl+I)"
        >
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); execCmd('insertUnorderedList') }}
          className="p-1 rounded hover:bg-gray-200 text-gray-600"
          title="无序列表"
        >
          <List className="h-3.5 w-3.5" />
        </button>
        <span className="ml-auto text-xs text-gray-300">富文本</span>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        style={{ minHeight: minH }}
        className="px-2 py-1.5 text-sm outline-none [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_em]:italic"
      />
    </div>
  )
}
