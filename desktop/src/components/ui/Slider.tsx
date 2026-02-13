

interface SliderProps {
    value: number;
    min: number;
    max: number;
    step?: number;
    onChange: (value: number) => void;
    label?: string;
    className?: string;
    formatValue?: (val: number) => string;
}

export function Slider({ value, min, max, step = 1, onChange, label, className, formatValue }: SliderProps) {
    return (
        <div className={className}>
            <div className="flex justify-between mb-1">
                {label && <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>}
                <span className="text-sm text-gray-500 dark:text-gray-400">{formatValue ? formatValue(value) : value}</span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-blue-600"
            />
        </div>
    );
}
