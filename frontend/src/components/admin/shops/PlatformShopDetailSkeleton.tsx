function PlatformShopDetailSkeleton() {
    return (
        <div className="animate-pulse space-y-6" aria-label="Loading shop">
            <div className="h-16 rounded-2xl border border-blue-100 bg-white shadow-sm" />
            <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
                <div className="space-y-6">
                    <div className="h-72 rounded-2xl border border-blue-100 bg-white shadow-sm" />
                    <div className="h-64 rounded-2xl border border-blue-100 bg-white shadow-sm" />
                </div>
                <div className="h-[34rem] rounded-2xl border border-blue-100 bg-white shadow-sm" />
            </div>
        </div>
    );
}

export default PlatformShopDetailSkeleton;
