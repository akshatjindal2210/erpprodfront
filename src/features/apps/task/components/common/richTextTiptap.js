import StarterKit from "@tiptap/starter-kit";

/** Both Form + read-only display should use this stack — do not separate. */
export function getRichTextExtensions() {
  return [
    StarterKit.configure({
      link: {
        openOnClick: true,
        autolink: true,
        defaultProtocol: "https",
      },
    }),
  ];
}

export const RICH_TEXT_PROSE_CLASS =
  "text-slate-700 text-sm focus:outline-none [&_p]:mb-2 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2 [&_li]:mb-1 [&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-slate-600 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_pre]:rounded-md [&_pre]:bg-slate-900 [&_pre]:text-slate-100 [&_pre]:p-3 [&_pre]:mb-2 [&_pre]:overflow-x-auto";

export const RICH_TEXT_EDITOR_SURFACE_CLASS = `${RICH_TEXT_PROSE_CLASS} min-h-[150px] px-4 py-3`;
