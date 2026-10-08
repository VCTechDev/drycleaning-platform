import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
    label: string;
    value: string;
    icon: LucideIcon;
    tone: "blue" | "indigo" | "emerald" | "amber" | "violet";
}

const toneClasses: Record<MetricCardProps["tone"], string> = {
    blue: "bg-blue-50 text-blue-700",
    indigo: "bg-indigo-50 text-indigo-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    violet: "bg-violet-50 text-violet-700",
};

function MetricCard({ label, value, icon: Icon, tone }: MetricCardProps) {
    return (
        <article className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
                <p className="text-sm font-medium text-slate-500">{label}</p>
                <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneClasses[tone]}`}
                    aria-hidden="true"
                >
                    <Icon className="h-5 w-5" />
                </div>
            </div>
            <p className="mt-5 font-heading text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                {value}
            </p>
        </article>
    );
}

export default MetricCard;

