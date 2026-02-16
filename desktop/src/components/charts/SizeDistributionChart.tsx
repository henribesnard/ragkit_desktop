interface SizeDistributionChartProps {
    buckets: Array<{ range_start: number; range_end: number; count: number }>;
}

export function SizeDistributionChart({ buckets }: SizeDistributionChartProps) {
    const max = Math.max(1, ...buckets.map((b) => b.count));

    return (
        <div className="space-y-2">
            {buckets.map((bucket) => (
                <div key={`${bucket.range_start}-${bucket.range_end}`} className="grid grid-cols-[110px_1fr_42px] items-center gap-2 text-xs">
                    <span className="text-gray-500 dark:text-gray-400">{bucket.range_start}-{bucket.range_end}</span>
                    <div className="h-3 rounded bg-gray-200 dark:bg-gray-700 overflow-hidden">
                        <div
                            className="h-full bg-blue-500"
                            style={{ width: `${(bucket.count / max) * 100}%` }}
                        />
                    </div>
                    <span className="text-gray-600 dark:text-gray-300 text-right">{bucket.count}</span>
                </div>
            ))}
        </div>
    );
}
