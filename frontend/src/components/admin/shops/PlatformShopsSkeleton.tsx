function PlatformShopsSkeleton() {
    return (
        <div className="animate-pulse space-y-6" aria-label="Loading shops">
            <div className="h-28 rounded-2xl border border-blue-100 bg-white shadow-sm" />
            <div className="hidden overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm md:block">
                <div className="h-14 border-b border-slate-100 bg-slate-50" />
                {Array.from({ length: 7 }, (_, index) => (
                    <div
                        key={index}
                        className="grid h-20 grid-cols-6 gap-4 border-b border-slate-100 px-6 py-5 last:border-0"
                    >
                        <div className="h-4 rounded bg-slate-200" />
                        <div className="h-4 rounded bg-slate-200" />
                        <div className="h-4 rounded bg-slate-200" />
                        <div className="h-7 w-24 rounded-full bg-slate-200" />
                        <div className="h-4 rounded bg-slate-200" />
                        <div className="h-8 w-16 rounded bg-slate-200" />
                    </div>
                ))}
            </div>
            <div className="space-y-3 md:hidden">
                {Array.from({ length: 5 }, (_, index) => (
                    <div
                        key={index}
                        className="h-52 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm"
                    />
                ))}
            </div>
        </div>
    );
}

export default PlatformShopsSkeleton;
