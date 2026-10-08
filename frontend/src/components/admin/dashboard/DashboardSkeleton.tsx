function DashboardSkeleton() {
    return (
        <div className="animate-pulse space-y-6" aria-label="Loading dashboard">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 8 }, (_, index) => (
                    <div
                        key={index}
                        className="h-36 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm"
                    >
                        <div className="h-4 w-28 rounded bg-slate-200" />
                        <div className="mt-8 h-8 w-24 rounded bg-slate-200" />
                    </div>
                ))}
            </div>
            <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
                <div className="h-80 rounded-2xl border border-blue-100 bg-white p-6 shadow-sm" />
                <div className="h-80 rounded-2xl border border-blue-100 bg-white p-6 shadow-sm" />
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
                {Array.from({ length: 2 }, (_, index) => (
                    <div
                        key={index}
                        className="h-72 rounded-2xl border border-blue-100 bg-white p-6 shadow-sm"
                    />
                ))}
            </div>
            <div className="h-56 rounded-2xl border border-blue-100 bg-white p-6 shadow-sm" />
        </div>
    );
}

export default DashboardSkeleton;

