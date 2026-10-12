function PlatformServicesSkeleton() {
    return (
        <div className="animate-pulse space-y-6" aria-label="Loading services">
            <div className="h-28 rounded-2xl border border-blue-100 bg-white shadow-sm" />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }, (_, index) => (
                    <div
                        key={index}
                        className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm"
                    >
                        <div className="h-40 bg-slate-200" />
                        <div className="space-y-3 p-5">
                            <div className="h-5 w-2/3 rounded bg-slate-200" />
                            <div className="h-4 w-full rounded bg-slate-200" />
                            <div className="h-4 w-4/5 rounded bg-slate-200" />
                            <div className="h-9 rounded bg-slate-200" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default PlatformServicesSkeleton;
