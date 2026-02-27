export function TypingIndicator() {
    return (
        <div className="flex justify-start animate-message-in">
            <div
                className="flex items-center gap-1.5 px-4 py-3"
                style={{
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "4px 20px 20px 20px",
                }}
            >
                {[0, 1, 2].map((i) => (
                    <div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                            background: "var(--text-tertiary)",
                            animation: `typing-dot 1s infinite`,
                            animationDelay: `${i * 150}ms`,
                        }}
                    />
                ))}
            </div>
        </div>
    );
}
