interface WordmarkProps {
    size?: number;
    color?: string;
}

export function Wordmark({ size = 20, color }: WordmarkProps) {
    return (
        <span
            style={{
                fontWeight: 600,
                fontSize: size,
                letterSpacing: "-0.03em",
                color: color || "var(--text)",
                lineHeight: 1,
            }}
        >
            LOKO
        </span>
    );
}
