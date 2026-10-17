import { BriefcaseBusiness } from "lucide-react";

function ShopServiceRequests() {
    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xs sm:p-8">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-[#2563EB]">
                        <BriefcaseBusiness className="h-6 w-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
                            Custom Service Requests
                        </h2>
                        <p className="text-sm text-slate-500">
                            Request new specialized services from platform administrators and track approval progress.
                        </p>
                    </div>
                </div>

                <div className="mt-8 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
                    <BriefcaseBusiness className="mx-auto h-8 w-8 text-slate-400" />
                    <p className="mt-3 text-sm font-medium text-slate-700">
                        Service Requests & Approval Tracking
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                        Submitting new service requests and viewing platform review decisions will be implemented in Step 3.
                    </p>
                </div>
            </div>
        </div>
    );
}

export default ShopServiceRequests;
