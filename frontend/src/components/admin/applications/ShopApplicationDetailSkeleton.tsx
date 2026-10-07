function ShopApplicationDetailSkeleton() {
    return (
        <div className="animate-pulse space-y-6" aria-label="Loading shop application">
            <div className="h-24 rounded-2xl border border-blue-100 bg-white shadow-sm" />
            <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                <div className="space-y-6">
                    <div className="h-64 rounded-2xl border border-blue-100 bg-white shadow-sm" />
                    <div className="h-64 rounded-2xl border border-blue-100 bg-white shadow-sm" />
                </div>
                <div className="h-96 rounded-2xl border border-blue-100 bg-white shadow-sm" />
            </div>
        </div>
    );
}

export default ShopApplicationDetailSkeleton;
