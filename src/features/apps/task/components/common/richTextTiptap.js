import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";

/** Both Form + read-only display should use this stack — do not separate. */
export function getRichTextExtensions() {
  return [
    StarterKit,
    Link.configure({
      openOnClick: true,
      autolink: true,
      defaultProtocol: "https",
    }),
  ];
}

/** Prose: RichTextEditor ke typing area jaisa (text-sm, lists, headings, blockquote). */
export const RICH_TEXT_PROSE_CLASS =
  "text-slate-700 text-sm focus:outline-none [&_p]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2 [&_li]:mb-1 [&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-slate-600";

export const RICH_TEXT_EDITOR_SURFACE_CLASS = `${RICH_TEXT_PROSE_CLASS} min-h-[150px] px-4 py-3`;
