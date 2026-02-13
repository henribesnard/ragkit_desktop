// desktop/src/hooks/useTheme.ts
import { useEffect, useState } from "react";

type Theme = "light" | "dark";

export function useTheme() {
    const [theme, setTheme] = useState<Theme>(() => {
        const stored = localStorage.getItem("ragkit-theme") as Theme | null;
        if (stored) return stored;
        return window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark" : "light";
    });

    useEffect(() => {
        const root = document.documentElement;
        root.classList.toggle("dark", theme === "dark");
        localStorage.setItem("ragkit-theme", theme);
    }, [theme]);

    const toggle = () => setTheme(t => t === "light" ? "dark" : "light");

    return { theme, toggle };
}
