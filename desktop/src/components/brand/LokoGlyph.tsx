interface LokoGlyphProps {
    size?: number;
    variant?: "tile" | "house" | "shield";
    mono?: boolean;
    radius?: number;
    title?: string;
    className?: string;
}

export function LokoGlyph({
    size = 32,
    variant = "tile",
    mono = false,
    radius,
    title,
    className,
}: LokoGlyphProps) {
    const fill = mono ? "currentColor" : "var(--brand)";
    const knock = mono ? "var(--knockout, #fff)" : "var(--brand-fg, #fff)";

    if (variant === "house") {
        return (
            <svg
                width={size}
                height={size}
                viewBox="0 0 48 48"
                fill="none"
                aria-label={title}
                role="img"
                className={className}
                stroke={mono ? "currentColor" : "var(--brand)"}
                strokeWidth="3.2"
                strokeLinejoin="round"
                strokeLinecap="round"
            >
                <path d="M9 21 L24 8 L39 21 V37 a3 3 0 0 1-3 3 H12 a3 3 0 0 1-3-3 Z" />
                <circle cx="24" cy="25.5" r="3.4" />
                <path d="M24 28.9 V34" />
            </svg>
        );
    }

    if (variant === "shield") {
        return (
            <svg
                width={size}
                height={size}
                viewBox="0 0 48 48"
                fill="none"
                aria-label={title}
                role="img"
                className={className}
                stroke={mono ? "currentColor" : "var(--brand)"}
                strokeWidth="3.2"
                strokeLinejoin="round"
                strokeLinecap="round"
            >
                <path d="M24 7 L39 13 V23 C39 32 32.5 38.5 24 41 C15.5 38.5 9 32 9 23 V13 Z" />
                <circle cx="24" cy="22" r="3.6" />
                <path d="M24 25.6 V31.5" />
            </svg>
        );
    }

    // tile (primary)
    const r = radius != null ? radius : 13;
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 48 48"
            aria-label={title}
            role="img"
            className={className}
        >
            <rect x="3" y="3" width="42" height="42" rx={r} fill={fill} />
            {/* subtle top sheen */}
            <rect
                x="3"
                y="3"
                width="42"
                height="42"
                rx={r}
                fill="url(#lokoSheen)"
                opacity={mono ? 0 : 0.16}
            />
            <defs>
                <linearGradient id="lokoSheen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
                    <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
                </linearGradient>
            </defs>
            {/* keyhole */}
            <g fill={knock}>
                <circle cx="24" cy="20.2" r="6.1" />
                <path d="M21.1 24.4 L19.3 32.6 a4.9 4.9 0 0 0 9.4 0 L26.9 24.4 Z" />
            </g>
        </svg>
    );
}
