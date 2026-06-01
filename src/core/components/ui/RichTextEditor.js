'use client'

import React, { useEffect, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Bold, Italic, Strikethrough, List, ListOrdered, Heading2, Heading3, Undo, Redo } from 'lucide-react'

function ToolbarBtn({ onClick, active, disabled, title, children }) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded-md transition-all text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed ${active ? 'bg-indigo-100 text-indigo-700' : ''}`}
    >
      {children}
    </button>
  )
}

const Divider = () => <div className="w-px h-5 bg-slate-200 mx-0.5" />

export default function RichTextEditor({ value, onChange, placeholder = "Write something..." }) {
  const [isClient, setIsClient] = useState(false)
  useEffect(() => setIsClient(true), [])

  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none text-slate-700 text-sm min-h-[150px] px-4 py-3 focus:outline-none',
      },
    },
    immediatelyRender: false,
  })

  // ── Sync value from props to editor ──────────────────────────────────
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '', false)
    }
  }, [value, editor])
  // ──────────────────────────────────────────────────────────────────────────

  if (!isClient || !editor) return (
    <div className="mt-1 border border-slate-200 rounded-xl bg-slate-50 h-[176px] animate-pulse" />
  )

  return (
    <div className="mt-1 border border-slate-200 rounded-xl overflow-hidden bg-white focus-within:ring-2 focus-within:ring-indigo-500 transition relative">
      {/* Toolbar */}
      <div className="flex items-center flex-wrap gap-0.5 px-2 py-2 border-b border-slate-100 bg-slate-50">
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2"><Heading2 size={14} /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3"><Heading3 size={14} /></ToolbarBtn>
        <Divider />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold"><Bold size={14} /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic"><Italic size={14} /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strike"><Strikethrough size={14} /></ToolbarBtn>
        <Divider />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullets"><List size={14} /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbers"><ListOrdered size={14} /></ToolbarBtn>
        <Divider />
        <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo"><Undo size={14} /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo"><Redo size={14} /></ToolbarBtn>
      </div>

      {/* Editor Area */}
      <div className="cursor-text relative">
        {editor.isEmpty && (
          <p className="absolute left-4 top-3 text-sm text-slate-400 pointer-events-none select-none z-10">
            {placeholder}
          </p>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}