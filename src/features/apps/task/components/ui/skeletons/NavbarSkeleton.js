import Skeleton from "../Skeleton";

export default function NavbarSkeleton() {
  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">

      <div className="flex items-center gap-4">
        <Skeleton className="w-6 h-6" />
        <Skeleton className="w-64 h-8 rounded-lg" />
      </div>

      <div className="flex items-center gap-4">
        <Skeleton className="w-6 h-6 rounded-full" />
        <Skeleton className="w-8 h-8 rounded-full" />
      </div>

    </header>
  );
}