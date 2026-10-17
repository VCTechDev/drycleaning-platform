import { LayoutDashboard, Store } from "lucide-react";
import { useShopAdminProfile } from "../../hooks/shopAdmin/useShopAdminProfile";

function ShopDashboard() {
    const { data: profile } = useShopAdminProfile();

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xs sm:p-8">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-[#2563EB]">
                        <LayoutDashboard className="h-6 w-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
                            Shop Dashboard
                        </h2>
                        <p className="text-sm text-slate-500">
                            Overview and operational command center for{" "}
                            <span className="font-semibold text-slate-800">
                                {profile?.shop_name || "your shop"}
                            </span>
                        </p>
                    </div>
                </div>

                <div className="mt-8 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
                    <Store className="mx-auto h-8 w-8 text-slate-400" />
                    <p className="mt-3 text-sm font-medium text-slate-700">
                        Dashboard Metrics & Recent Orders Preview
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                        Operational KPI cards, quick actions, and order overview will be implemented in Step 5.
                    </p>
                </div>
            </div>
        </div>
    );
}

export default ShopDashboard;
