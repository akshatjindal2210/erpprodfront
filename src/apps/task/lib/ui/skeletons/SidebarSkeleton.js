import Skeleton from "../Skeleton";

export default function SidebarSkeleton() {
  return (
    <aside className="w-64 h-screen bg-white border-r border-slate-200 flex flex-col">

      <div className="h-16 flex items-center px-6 border-b border-slate-100">
        <Skeleton className="w-8 h-8 rounded-md" />
        <Skeleton className="ml-3 w-24 h-4" />
      </div>

      <div className="flex-1 p-4 space-y-3">
        <Skeleton className="h-10 rounded-lg" />
        <Skeleton className="h-10 rounded-lg" />
        <Skeleton className="h-10 rounded-lg" />
        <Skeleton className="h-10 rounded-lg" />
      </div>

      <div className="p-4 border-t border-slate-100">
        <Skeleton className="h-10 rounded-lg" />
      </div>

    </aside>
  );
}