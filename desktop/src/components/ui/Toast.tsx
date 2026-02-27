import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";

interface ToastProps {
    message: string;
    visible: boolean;
    onClose: () => void;
    duration?: number;
}

export function Toast({ message, visible, onClose, duration = 3000 }: ToastProps) {
    const [show, setShow] = useState(false);

    useEffect(() => {
        if (visible) {
            setShow(true);
            const timer = setTimeout(() => {
                setShow(false);
                setTimeout(onClose, 200);
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [visible, duration, onClose]);

    if (!visible && !show) return null;

    return createPortal(
        <div
            className={show ? "animate-slide-up" : ""}
            style={{
                position: "fixed",
                bottom: 32,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 300,
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 20px",
                borderRadius: "var(--radius-md)",
                background: "var(--success)",
                color: "white",
                fontSize: 13,
                fontWeight: 500,
                boxShadow: "var(--shadow-md)",
                opacity: show ? 1 : 0,
                transition: "opacity 200ms ease-out",
            }}
        >
            <Check size={16} />
            {message}
        </div>,
        document.body
    );
}
