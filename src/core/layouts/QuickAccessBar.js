"use client";
import { useRouter, usePathname } from "next/navigation";
import { useState, useMemo, useEffect, useCallback } from "react";
import { HelpCircle, Info, ChevronDown, BookOpen, Loader2, VideoOff, Keyboard, Tag } from "lucide-react";
import { useSelector } from "react-redux";
import { QUICK_LINKS_CONFIG } from "@/features/apps/ims/config/quickLinks";
import { NAV_REGISTRY } from "@/features/apps/ims/config/navRegistry";
import { THEME_CONFIG } from "@/config/theme";
import Drawer from "@/core/components/ui/Drawer";
import { trainingVideoService } from "@/features/admin/services/trainingService";
import { selectPermissions } from "@/core/store/slices/authSlice";
import { useCanAccess } from "@/core/hooks/useCanAccess";
import { isPwaStandalone, getListHotkeyParts } from "@/core/utils/pwa";
import { APP_VERSION } from "@/config/appVersion";

const kbdClass = "px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[9px] font-black shadow-sm text-slate-900 leading-none";

function ShortcutKbdParts({ parts }) {
  return (
    <div className="flex gap-1 items-center flex-wrap justify-end">
      {parts.map((part, i) => (
        <span key={`${part}-${i}`} className="flex items-center gap-1">
          {i > 0 && <span className="text-slate-400 font-bold">+</span>}
          <kbd className={kbdClass}>{part}</kbd>
        </span>
      ))}
    </div>
  );
}

function ShortcutRow({ label, parts }) {
  return (
    <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
      <span className="text-[10px] font-bold text-slate-500 uppercase leading-tight">{label}</span>
      <ShortcutKbdParts parts={parts} />
    </div>
  );
}

export default function QuickAccessBar({ hideQuickLinks = false }) {
  const router = useRouter();
  const pathname = usePathname();
  const permissions = useSelector(selectPermissions);
  const role = useSelector(state => state.auth.role);
  const canAccess = useCanAccess();
  const [helpOpen, setHelpOpen] = useState(false);
  const [expandedDesc, setExpandedDesc] = useState({});
  const [trainingData, setTrainingData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isPwa, setIsPwa] = useState(false);

  useEffect(() => {
    const sync = () => setIsPwa(isPwaStandalone());
    sync();
    const mq = window.matchMedia?.("(display-mode: standalone)");
    mq?.addEventListener?.("change", sync);
    return () => mq?.removeEventListener?.("change", sync);
  }, []);

  const shortcutRows = useMemo(
    () => [
      { id: "save", label: "Save / Submit", parts: ["CTRL", "S"] },
      { id: "closeOverlay", label: "Close Modal / Form", parts: ["ESC"] },
      { id: "copyRow", label: "Copy Row Data", parts: ["CTRL", "C"] },
      { id: "authorize", label: "Authorize Selected", parts: ["CTRL", "A"] },
      { id: "listNew", label: "New Form (list)", parts: getListHotkeyParts("n", isPwa) },
      { id: "listEdit", label: "Edit Selected (list)", parts: getListHotkeyParts("e", isPwa) },
      { id: "listPrint", label: "Print Selected (list)", parts: getListHotkeyParts("p", isPwa) },
    ],
    [isPwa]
  );

  const currentModule = useMemo(() => {
    for (const item of NAV_REGISTRY) {
      if (item.href === pathname) return item;
      if (item.subItems) {
        const sub = item.subItems.find(s => s.href === pathname);
        if (sub) return sub;
      }
    }
    return null;
  }, [pathname]);

  const filteredQuickLinks = useMemo(() => {
    return QUICK_LINKS_CONFIG.filter(link => {
      if (!link.module) return true;
      const access = canAccess(link.module, "view");
      return typeof access === "object" ? access.allowed : !!access;
    });
  }, [canAccess]);

  const fetchVideos = useCallback(async () => {
    const slug = currentModule?.module;
    if (!slug) return;

    setLoading(true);
    try {
      const res = await trainingVideoService.getViews({
        module_slug: slug,
        permission_module: slug,
        permission_action: "view",
      });
      if (res.success) {
        setTrainingData(res.data || []);
      }
    } catch (error) {
      console.error("Help fetch error:", error);
    } finally {
      setLoading(false);
    }
  }, [currentModule]);

  // 3. Trigger fetch when drawer opens or module changes
  useEffect(() => {
    if (helpOpen) {
      fetchVideos();
    } else {
      setTrainingData([]);
    }
  }, [helpOpen, fetchVideos]);

  // Helper: YouTube URL parser
  const getEmbedUrl = (url) => {
    if (!url) return "";
    if (url.includes('iframe')) {
      const src = url.match(/src="([^"]+)"/);
      return src ? src[1] : "";
    }
    // Clean URL for embedding
    let videoId = "";
    if (url.includes('v=')) videoId = url.split('v=')[1].split('&')[0];
    else if (url.includes('youtu.be/')) videoId = url.split('youtu.be/')[1].split('?')[0];
    else return url;

    return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
  };

  const toggleDesc = (id) => {
    setExpandedDesc(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (hideQuickLinks) {
    return (
      <nav
        className={`h-10 md:h-9 ${THEME_CONFIG.footerBg} border-b ${THEME_CONFIG.sidebarBorder} px-4 shrink-0`}
        aria-hidden
      />
    );
  }

  return (
    <>
      <nav className={`h-10 md:h-9 ${THEME_CONFIG.footerBg} backdrop-blur-md border-b ${THEME_CONFIG.sidebarBorder} px-4 flex items-center justify-between gap-2 shadow-sm`}>
        {/* Quick Links Section */}
        <div className="flex items-center gap-5 md:gap-7 overflow-x-auto no-scrollbar py-1 flex-1">
          {filteredQuickLinks.map((link) => (
            <button key={link.id} onClick={() => router.push(link.path)} className="flex items-center gap-2 group shrink-0 relative py-1 hover:opacity-80 transition-opacity">
              <span className={`${THEME_CONFIG.sidebarIcon}`}>{link.icon}</span>
              <span className={`text-[9px] md:text-[10px] font-bold ${THEME_CONFIG.sidebarText} uppercase tracking-wider whitespace-nowrap`}>
                {link.label}
              </span>
            </button>
          ))}
        </div>

        {/* Help Guide Button */}
        {currentModule && (
          <div className="pl-2 border-l border-slate-200">
            <button 
              onClick={() => setHelpOpen(true)} 
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white md:bg-indigo-50 md:text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all active:scale-95"
            >
              <HelpCircle size={14} className="animate-pulse" />
              {/* <span className="hidden md:block text-[10px] font-black uppercase tracking-tight">Help Guide</span> */}
            </button>
          </div>
        )}
      </nav>

      {/* Help Drawer */}
      <Drawer
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-indigo-600" />
            <span className="text-slate-800 font-bold uppercase text-xs tracking-widest">{currentModule?.name}</span>
          </div>
        }
        maxWidth="max-w-md"
      >
        <div className="space-y-6 pb-10">

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-4">
              <Loader2 className="animate-spin text-indigo-500" size={40} strokeWidth={3} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Syncing Module Data</span>
            </div>
          ) : trainingData.length > 0 ? (
            trainingData.map((item) => (
              <div key={item.id} className="mb-5 bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
                {/* Video Section */}
                <div className="aspect-video bg-black relative">
                  <iframe 
                    className="w-full h-full"
                    src={getEmbedUrl(item.video_url)}
                    title={item.title}
                    allowFullScreen
                    loading="lazy"
                  ></iframe>
                </div>

                {/* Content Section */}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-black text-black uppercase tracking-tight">
                      {item.title}
                    </h3>
                    <span className="text-[8px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200 uppercase">
                      {item.permission_type}
                    </span>
                  </div>

                  {/* Documentation Button */}
                  <button 
                    onClick={() => toggleDesc(item.id)} 
                    className={expandedDesc[item.id] 
                      ? 'w-full flex items-center justify-between py-2 px-3 rounded-xl bg-black text-white transition-all' 
                      : 'w-full flex items-center justify-between py-2 px-3 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-all'
                    }
                  >
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase">
                      <Info size={14} strokeWidth={3} /> 
                      <span>Documentation</span>
                    </div>
                    <ChevronDown 
                      size={16} 
                      strokeWidth={3}
                      className={expandedDesc[item.id] ? 'rotate-180 transition-transform' : 'transition-transform'} 
                    />
                  </button>

                  {/* Description Content */}
                  {expandedDesc[item.id] && (
                    <div className="mt-3 p-3 bg-slate-50 rounded-xl border-l-4 border-indigo-500">
                      <div 
                        className="text-[12px] text-slate-700 leading-relaxed prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: item.description }} 
                      />
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-20 px-6 bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-200">
              <VideoOff className="mx-auto text-slate-300 mb-4" size={48} />
              <p className="text-sm font-bold text-slate-500 uppercase tracking-tight">No tutorials found</p>
              <p className="text-[10px] text-slate-400 mt-1">Documentation is not yet uploaded for this module.</p>
            </div>
          )}

          {/* Keyboard Shortcuts — not useful on phone / touch; show md+ */}
          <div className="hidden md:block mt-8 pt-6 border-t border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <Keyboard size={16} className="text-indigo-600" />
              <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider">Keyboard Shortcuts</h4>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {shortcutRows.map((row) => (
                <ShortcutRow key={row.id} label={row.label} parts={row.parts} />
              ))}
            </div>

          </div>

          <div className="mt-5 pt-5 border-t border-slate-200">
            <div className="flex items-center justify-between gap-3 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
              <div className="flex items-center gap-2 min-w-0">
                <Tag size={14} className="text-indigo-600 shrink-0" />
                <span className="text-[10px] font-black text-indigo-700 uppercase tracking-wider">
                  App Version
                </span>
              </div>
              <span className="text-sm font-black text-slate-800 font-mono tracking-tight shrink-0">
                v{APP_VERSION}
              </span>
            </div>
          </div>
        </div>
      </Drawer>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </>
  );
}
