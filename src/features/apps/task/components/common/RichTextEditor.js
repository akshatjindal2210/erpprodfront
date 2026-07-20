"use client";

import { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { Bold, Italic, Strikethrough, List, ListOrdered, Heading1, Heading2, Heading3, Pilcrow, Quote, Minus, Eraser, LinkIcon, Link2Off, Undo, Redo, Code, Code2 } from "lucide-react";
import { getRichTextExtensions, RICH_TEXT_EDITOR_SURFACE_CLASS, RICH_TEXT_PROSE_CLASS } from "./richTextTiptap";

function ToolbarBtn({ onClick, active, disabled, title, children, className = "p-1.5" }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      disabled={disabled}
      title={title}
      className={`${className} rounded-md transition-all text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed ${
        active ? "bg-indigo-100 text-indigo-700" : ""
      }`}
    >
      {children}
    </button>
  );
}

const Divider = () => <div className="w-px h-5 bg-slate-200 mx-0.5 shrink-0" />;

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Write something...",
  /** Shorter starting height only — toolbar stays full. */
  compact = false,
  /** Drag bottom-right corner to grow the editor. */
  resizable = false,
}) {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => setIsClient(true), []);

  const surfaceClass = resizable
    ? `${RICH_TEXT_PROSE_CLASS} min-h-full h-full px-3 py-2 text-sm`
    : compact
      ? `${RICH_TEXT_PROSE_CLASS} min-h-[88px] px-3 py-2 text-sm`
      : RICH_TEXT_EDITOR_SURFACE_CLASS;

  const editor = useEditor({
    extensions: getRichTextExtensions(),
    content: value || "",
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getHTML());
    },
    editorProps: {
      attributes: {
        class: surfaceClass,
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const html = value || "";
    if (html !== editor.getHTML()) {
      editor.commands.setContent(html, false);
    }
  }, [value, editor]);

  if (!isClient || !editor) {
    return (
      <div
        className={`mt-1 border border-slate-200 rounded-lg overflow-hidden bg-slate-50 ${
          compact ? "h-[120px]" : "h-[176px]"
        } animate-pulse`}
      />
    );
  }

  const setLink = () => {
    const previousUrl = editor.getAttributes("link").href || "";
    const url = window.prompt("Enter URL", previousUrl);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const iconSize = compact ? 13 : 14;
  const btnClass = compact ? "p-1" : "p-1.5";

  return (
    <div
      className={`border border-slate-200 rounded-lg bg-white focus-within:ring-2 focus-within:ring-indigo-500 transition relative ${
        compact ? "" : "mt-1"
      }`}
    >
      <div
        className={`flex items-center flex-wrap gap-0.5 px-1.5 border-b border-slate-100 bg-slate-50 rounded-t-lg ${
          compact ? "py-0.5" : "py-1.5"
        }`}
      >
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive("heading", { level: 1 })}
          title="Heading 1"
          className={btnClass}
        >
          <Heading1 size={iconSize} />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })}
          title="Heading 2"
          className={btnClass}
        >
          <Heading2 size={iconSize} />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive("heading", { level: 3 })}
          title="Heading 3"
          className={btnClass}
        >
          <Heading3 size={iconSize} />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().setParagraph().run()}
          active={editor.isActive("paragraph")}
          title="Paragraph"
          className={btnClass}
        >
          <Pilcrow size={iconSize} />
        </ToolbarBtn>
        <Divider />
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="Bold"
          className={btnClass}
        >
          <Bold size={iconSize} />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="Italic"
          className={btnClass}
        >
          <Italic size={iconSize} />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive("strike")}
          title="Strike"
          className={btnClass}
        >
          <Strikethrough size={iconSize} />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive("code")}
          title="Inline code"
          className={btnClass}
        >
          <Code size={iconSize} />
        </ToolbarBtn>
        <Divider />
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          title="Bullets"
          className={btnClass}
        >
          <List size={iconSize} />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          title="Numbers"
          className={btnClass}
        >
          <ListOrdered size={iconSize} />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive("blockquote")}
          title="Quote"
          className={btnClass}
        >
          <Quote size={iconSize} />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive("codeBlock")}
          title="Code block"
          className={btnClass}
        >
          <Code2 size={iconSize} />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontal Line"
          className={btnClass}
        >
          <Minus size={iconSize} />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          title="Clear Formatting"
          className={btnClass}
        >
          <Eraser size={iconSize} />
        </ToolbarBtn>
        <ToolbarBtn onClick={setLink} active={editor.isActive("link")} title="Add/Edit Link" className={btnClass}>
          <LinkIcon size={iconSize} />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().unsetLink().run()}
          disabled={!editor.isActive("link")}
          title="Remove Link"
          className={btnClass}
        >
          <Link2Off size={iconSize} />
        </ToolbarBtn>
        <Divider />
        <ToolbarBtn
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().chain().focus().undo().run()}
          title="Undo"
          className={btnClass}
        >
          <Undo size={iconSize} />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().chain().focus().redo().run()}
          title="Redo"
          className={btnClass}
        >
          <Redo size={iconSize} />
        </ToolbarBtn>
      </div>

      <div
        className={`cursor-text relative ${
          resizable
            ? `resize-y overflow-auto ${compact ? "min-h-[88px] h-[120px] max-h-[420px]" : "min-h-[150px] h-[180px] max-h-[520px]"}`
            : ""
        }`}
      >
        {editor.isEmpty && (
          <p
            className={`absolute left-3 text-slate-400 pointer-events-none select-none z-10 ${
              compact ? "top-2 text-xs" : "left-4 top-3 text-sm"
            }`}
          >
            {placeholder}
          </p>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
