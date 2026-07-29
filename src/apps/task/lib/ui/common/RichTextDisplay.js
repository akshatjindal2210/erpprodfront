"use client";

import { useEffect, useMemo, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { getRichTextExtensions, RICH_TEXT_PROSE_CLASS } from "./richTextTiptap";

/** Displays saved description like form's RichTextEditor — same TipTap + same prose class. */
export default function RichTextDisplay({ value, className = "" }) {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => setIsClient(true), []);

  const extensions = useMemo(() => getRichTextExtensions(), []);

  const editor = useEditor({
    extensions,
    content: value || "",
    editable: false,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: RICH_TEXT_PROSE_CLASS,
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
    return <div className={className} aria-hidden />;
  }

  return (
    <div className={className}>
      <EditorContent editor={editor} />
    </div>
  );
}
