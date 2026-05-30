import { useRef, useState, useCallback } from "react";

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

/**
 * Slider component using LOKO design system
 * Uses .loko-slider CSS class from index.css
 */
export function Slider({ value, min, max, step = 1, onChange, label, className, formatValue }: SliderProps) {
    const sliderRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const percentage = ((value - min) / (max - min)) * 100;

    const updateValue = useCallback(
        (clientX: number) => {
            if (!sliderRef.current) return;
            const rect = sliderRef.current.getBoundingClientRect();
            const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            let newValue = min + percent * (max - min);

            // Apply step
            if (step !== 1) {
                newValue = Math.round(newValue / step) * step;
            }

            newValue = Math.max(min, Math.min(max, newValue));
            onChange(newValue);
        },
        [min, max, step, onChange]
    );

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        updateValue(e.clientX);
    };

    const handleMouseMove = useCallback(
        (e: MouseEvent) => {
            if (isDragging) {
                updateValue(e.clientX);
            }
        },
        [isDragging, updateValue]
    );

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    // Attach global mouse event listeners when dragging
    useState(() => {
        if (isDragging) {
            window.addEventListener("mousemove", handleMouseMove);
            window.addEventListener("mouseup", handleMouseUp);
            return () => {
                window.removeEventListener("mousemove", handleMouseMove);
                window.removeEventListener("mouseup", handleMouseUp);
            };
        }
    });

    return (
        <div className={className}>
            {(label || formatValue) && (
                <div className="flex justify-between mb-2">
                    {label && (
                        <label className="text-sm font-medium" style={{ color: "var(--text)" }}>
                            {label}
                        </label>
                    )}
                    <span className="text-sm font-mono" style={{ color: "var(--text-2)" }}>
                        {formatValue ? formatValue(value) : value}
                    </span>
                </div>
            )}
            <div
                ref={sliderRef}
                className="loko-slider"
                onMouseDown={handleMouseDown}
                style={{ cursor: isDragging ? "grabbing" : "grab" }}
            >
                <div className="fill" style={{ width: `${percentage}%` }} />
                <div className="knob" style={{ left: `${percentage}%` }} />
            </div>
        </div>
    );
}
