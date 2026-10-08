import { useEffect, useId, useRef, useState } from "react";

import type { PlatformTrendPoint } from "../../../types/platform/dashboard";

interface TrendChartProps {
    title: string;
    description: string;
    data: PlatformTrendPoint[];
    accent: "blue" | "indigo" | "violet";
}

const accentClasses: Record<TrendChartProps["accent"], string> = {
    blue: "fill-blue-500",
    indigo: "fill-indigo-500",
    violet: "fill-violet-500",
};

const formatDate = (dateValue: string) => {
    const date = new Date(`${dateValue}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return dateValue;
    }

    return new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
    }).format(date);
};

function TrendChart({ title, description, data, accent }: TrendChartProps) {
    const chartId = useId();
    const titleId = `${chartId}-title`;
    const descriptionId = `${chartId}-description`;
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(0);

    useEffect(() => {
        const chartContainer = chartContainerRef.current;

        if (!chartContainer) {
            return;
        }

        const updateWidth = () => {
            setContainerWidth(chartContainer.clientWidth);
        };

        updateWidth();

        const resizeObserver = new ResizeObserver(updateWidth);
        resizeObserver.observe(chartContainer);

        return () => resizeObserver.disconnect();
    }, []);

    if (data.length === 0) {
        return (
            <section className="min-w-0 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:p-6">
                <div>
                    <h2 className="font-heading text-base font-semibold text-slate-950">
                        {title}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">{description}</p>
                </div>
                <div className="mt-8 flex min-h-44 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm text-slate-500">
                    No recorded data for this period.
                </div>
            </section>
        );
    }

    const chartWidth = containerWidth || 320;
    const chartHeight = 280;
    const plotTop = 18;
    const plotBottom = 218;
    const plotHeight = plotBottom - plotTop;
    const maxCount = Math.max(...data.map((point) => point.count), 1);
    const slotWidth = chartWidth / data.length;
    const barGap = Math.min(10, slotWidth * 0.28);
    const barWidth = Math.max(1, slotWidth - barGap);
    const labelIndexes =
        chartWidth < 420 && data.length > 2
            ? [0, data.length - 1]
            : Array.from(
                  new Set([0, Math.floor((data.length - 1) / 2), data.length - 1])
              );

    return (
        <section className="min-w-0 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:p-6">
            <div>
                <h2 className="font-heading text-base font-semibold text-slate-950">
                    {title}
                </h2>
                <p className="mt-1 text-sm text-slate-500">{description}</p>
            </div>

            <div ref={chartContainerRef} className="mt-6 min-w-0 pb-1">
                <svg
                    className="block h-auto w-full max-w-full"
                    width="100%"
                    height={chartHeight}
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    role="img"
                    aria-labelledby={`${titleId} ${descriptionId}`}
                >
                    <title id={titleId}>{title}</title>
                    <desc id={descriptionId}>
                        {description}. Only dates returned by the backend are shown.
                    </desc>
                    <line
                        x1="0"
                        y1={plotBottom}
                        x2={chartWidth}
                        y2={plotBottom}
                        className="stroke-slate-200"
                    />
                    <text
                        x="0"
                        y={plotTop}
                        className="fill-slate-400 text-[11px]"
                    >
                        {maxCount}
                    </text>
                    <text
                        x="0"
                        y={plotBottom - 4}
                        className="fill-slate-400 text-[11px]"
                    >
                        0
                    </text>
                    {data.map((point, index) => {
                        const barHeight =
                            (Math.max(point.count, 0) / maxCount) * plotHeight;
                        const x = index * slotWidth + (slotWidth - barWidth) / 2;
                        const y = plotBottom - barHeight;

                        return (
                            <g key={`${point.date}-${index}`}>
                                <rect
                                    x={x}
                                    y={y}
                                    width={barWidth}
                                    height={Math.max(barHeight, 2)}
                                    rx="4"
                                    className={accentClasses[accent]}
                                >
                                    <title>
                                        {formatDate(point.date)}: {point.count}
                                    </title>
                                </rect>
                                {labelIndexes.includes(index) && (
                                    <text
                                        x={x + barWidth / 2}
                                        y={plotBottom + 24}
                                        textAnchor="middle"
                                        className="fill-slate-500 text-[11px]"
                                    >
                                        {formatDate(point.date)}
                                    </text>
                                )}
                            </g>
                        );
                    })}
                </svg>
            </div>
            <p className="mt-2 text-xs text-slate-400">
                Dates with recorded activity only; missing dates are not treated as zero.
            </p>
        </section>
    );
}

export default TrendChart;

