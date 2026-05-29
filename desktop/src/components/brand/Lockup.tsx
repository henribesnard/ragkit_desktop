import { LokoGlyph } from "./LokoGlyph";
import { Wordmark } from "./Wordmark";

interface LockupProps {
    glyph?: number;
    text?: number;
    gap?: number;
    variant?: "tile" | "house" | "shield";
    mono?: boolean;
    color?: string;
}

export function Lockup({
    glyph = 26,
    text = 20,
    gap = 10,
    variant = "tile",
    mono = false,
    color,
}: LockupProps) {
    return (
        <span style={{ display: "inline-flex", alignItems: "center", gap }}>
            <LokoGlyph size={glyph} variant={variant} mono={mono} />
            <Wordmark size={text} color={color} />
        </span>
    );
}
