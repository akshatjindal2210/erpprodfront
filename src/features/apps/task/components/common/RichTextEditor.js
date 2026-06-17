"use client";

import { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { Bold, Italic, Strikethrough, List, ListOrdered, Heading2, Heading3, Pilcrow, Quote, Minus, Eraser, LinkIcon, Link2Off, Undo, Redo, } from "lucide-react";
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

const Divider = () => <div className="w-px h-5 bg-slate-200 mx-0.5" />;

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Write something...",
  compact = false,
}) {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => setIsClient(true), []);

  const editor = useEditor({
    extensions: getRichTextExtensions(),
    content: value || "",
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getHTML());
    },
    editorProps: {
      attributes: {
        class: compact
          ? `${RICH_TEXT_PROSE_CLASS} min-h-[72px] px-3 py-2 text-sm`
          : RICH_TEXT_EDITOR_SURFACE_CLASS,
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
      <div className={`mt-1 border border-slate-200 rounded-lg overflow-hidden bg-slate-50 ${compact ? "h-[100px]" : "h-[176px]"} animate-pulse`} />
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

  const toolbar = compact ? (
    <>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold" className={btnClass}>
        <Bold size={iconSize} />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic" className={btnClass}>
        <Italic size={iconSize} />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullets" className={btnClass}>
        <List size={iconSize} />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numbers" className={btnClass}>
        <ListOrdered size={iconSize} />
      </ToolbarBtn>
      <ToolbarBtn onClick={setLink} active={editor.isActive("link")} title="Link" className={btnClass}>
        <LinkIcon size={iconSize} />
      </ToolbarBtn>
    </>
  ) : (
    <>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })}
          title="Heading 2"
        >
          <Heading2 size={14} />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive("heading", { level: 3 })}
          title="Heading 3"
        >
          <Heading3 size={14} />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().setParagraph().run()}
          active={editor.isActive("paragraph")}
          title="Paragraph"
        >
          <Pilcrow size={14} />
        </ToolbarBtn>
        <Divider />
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="Bold"
        >
          <Bold size={14} />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="Italic"
        >
          <Italic size={14} />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive("strike")}
          title="Strike"
        >
          <Strikethrough size={14} />
        </ToolbarBtn>
        <Divider />
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          title="Bullets"
        >
          <List size={14} />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          title="Numbers"
        >
          <ListOrdered size={14} />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive("blockquote")}
          title="Quote"
        >
          <Quote size={14} />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontal Line"
        >
          <Minus size={14} />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          title="Clear Formatting"
        >
          <Eraser size={14} />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={setLink}
          active={editor.isActive("link")}
          title="Add/Edit Link"
        >
          <LinkIcon size={14} />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().unsetLink().run()}
          disabled={!editor.isActive("link")}
          title="Remove Link"
        >
          <Link2Off size={14} />
        </ToolbarBtn>
        <Divider />
        <ToolbarBtn
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().chain().focus().undo().run()}
          title="Undo"
        >
          <Undo size={14} />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().chain().focus().redo().run()}
          title="Redo"
        >
          <Redo size={14} />
        </ToolbarBtn>
    </>
  );

  return (
    <div className={`border border-slate-200 rounded-lg overflow-hidden bg-white focus-within:ring-2 focus-within:ring-indigo-500 transition relative ${compact ? "" : "mt-1"}`}>
      <div className={`flex items-center flex-wrap gap-0.5 px-1.5 border-b border-slate-100 bg-slate-50 ${compact ? "py-0.5" : "py-2"}`}>
        {toolbar}
      </div>

      <div className="cursor-text relative">
        {editor.isEmpty && (
          <p className={`absolute left-3 text-slate-400 pointer-events-none select-none z-10 ${compact ? "top-2 text-xs" : "left-4 top-3 text-sm"}`}>
            {placeholder}
          </p>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
