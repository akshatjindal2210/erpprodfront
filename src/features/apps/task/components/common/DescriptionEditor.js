"use client"; // ensures client-side only rendering

import React, { useEffect } from "react";
import dynamic from "next/dynamic";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

// Dynamic import for SSR-safe editor content
const EditorContent = dynamic(
  () => import("@tiptap/react").then((mod) => mod.EditorContent),
  { ssr: false }
);

export default function DescriptionEditor({ value, onChange, error, okCls, errCls, placeholder }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value || "",
    onUpdate: ({ editor }) => {
      onChange({ target: { value: editor.getHTML() } });
    },
    editorProps: {
      attributes: { "data-immediately-render": false }, // avoids hydration mismatch
    },
  });

  useEffect(() => {
    return () => editor?.destroy();
  }, [editor]);

  return (
    <div>
      {editor && (
        <EditorContent
          editor={editor}
          placeholder={placeholder || "Task description"}
          className={error ? errCls : okCls}
          style={{ minHeight: "80px", padding: "8px", border: "1px solid #ccc", overflow: "hidden" }}
        />
      )}
      {error && <div className="text-red-500 text-sm mt-1">{error}</div>}
    </div>
  );
}