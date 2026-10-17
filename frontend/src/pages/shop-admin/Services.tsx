import { Wrench } from "lucide-react";

function ShopServices() {
    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xs sm:p-8">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-[#2563EB]">
                        <Wrench className="h-6 w-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
                            Shop Services
                        </h2>
                        <p className="text-sm text-slate-500">
                            Configure dry-cleaning and laundry services, pricing, and estimated turnaround days.
                        </p>
                    </div>
                </div>

                <div className="mt-8 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
                    <Wrench className="mx-auto h-8 w-8 text-slate-400" />
                    <p className="mt-3 text-sm font-medium text-slate-700">
                        Service Catalog & Pricing Configuration
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                        Adding services from the platform catalog, pricing edits, and active status controls will be implemented in Step 3.
                    </p>
                </div>
            </div>
        </div>
    );
}

export default ShopServices;
