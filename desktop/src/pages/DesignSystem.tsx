import { useState } from "react";
import { LokoGlyph } from "@/components/brand/LokoGlyph";
import { Wordmark } from "@/components/brand/Wordmark";
import { Toggle } from "@/components/ui/Toggle";
import { Slider } from "@/components/ui/Slider";
import {
    CheckCircle2,
    Settings,
    Shield,
    Zap,
    ChevronDown,
    Lock,
    Search,
    Star,
} from "lucide-react";

/**
 * Design System Demo Page
 * Visual reference for all LOKO components and styles
 *
 * To view: Add route in App.tsx
 * <Route path="/design" element={<DesignSystem />} />
 */
export function DesignSystem() {
    const [toggle1, setToggle1] = useState(true);
    const [toggle2, setToggle2] = useState(false);
    const [sliderValue, setSliderValue] = useState(512);
    const [selectedCard, setSelectedCard] = useState<number>(0);

    return (
        <div style={{ background: "var(--bg)", minHeight: "100vh", padding: 40 }}>
            <div style={{ maxWidth: 1200, margin: "0 auto" }}>
                {/* Header */}
                <div style={{ marginBottom: 48 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
                        <LokoGlyph size={48} />
                        <div>
                            <h1 style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-.03em" }}>
                                LOKO Design System
                            </h1>
                            <p style={{ fontSize: 14, color: "var(--text-2)", marginTop: 4 }}>
                                Visual reference for components, colors, and typography
                            </p>
                        </div>
                    </div>
                    <div className="loko-divider" style={{ marginTop: 24 }} />
                </div>

                {/* Colors */}
                <Section title="Colors" subtitle="Brand scale and theme tokens">
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                        {/* Brand Scale */}
                        <div className="loko-card" style={{ padding: 24 }}>
                            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
                                Brand Scale (Sovereign Teal)
                            </h3>
                            <div style={{ display: "grid", gap: 8 }}>
                                {[50, 100, 200, 300, 400, 500, 600, 700, 800].map((shade) => (
                                    <div
                                        key={shade}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 12,
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: 48,
                                                height: 32,
                                                borderRadius: 6,
                                                background: `var(--brand-${shade})`,
                                                border: "1px solid rgba(0,0,0,.08)",
                                            }}
                                        />
                                        <span
                                            style={{
                                                fontFamily: "var(--font-mono)",
                                                fontSize: 13,
                                                color: "var(--text-2)",
                                            }}
                                        >
                                            --brand-{shade}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Semantic Colors */}
                        <div className="loko-card" style={{ padding: 24 }}>
                            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
                                Semantic Colors
                            </h3>
                            <div style={{ display: "grid", gap: 12 }}>
                                <ColorSwatch label="Surface" token="--surface" />
                                <ColorSwatch label="Text" token="--text" />
                                <ColorSwatch label="Text Secondary" token="--text-2" />
                                <ColorSwatch label="Border" token="--border" />
                                <ColorSwatch label="Brand" token="--brand" />
                                <ColorSwatch label="Warning" token="--warn" />
                                <ColorSwatch label="Danger" token="--danger" />
                            </div>
                        </div>
                    </div>
                </Section>

                {/* Typography */}
                <Section title="Typography" subtitle="Geist font family with type scale">
                    <div className="loko-card" style={{ padding: 32 }}>
                        <div style={{ display: "grid", gap: 24 }}>
                            <div>
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: "var(--text-3)",
                                        marginBottom: 8,
                                        fontFamily: "var(--font-mono)",
                                    }}
                                >
                                    H1 · 26-38px · 600 · -0.025em
                                </div>
                                <h1 style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-.025em" }}>
                                    The quick brown fox jumps
                                </h1>
                            </div>
                            <div className="loko-divider" />
                            <div>
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: "var(--text-3)",
                                        marginBottom: 8,
                                        fontFamily: "var(--font-mono)",
                                    }}
                                >
                                    Body · 14px · 400 · -0.011em
                                </div>
                                <p style={{ fontSize: 14, lineHeight: 1.5 }}>
                                    LOKO indexe vos fichiers localement, sans télémétrie, et répond en
                                    langage naturel avec des citations vérifiables. Vos données restent
                                    sous votre contrôle.
                                </p>
                            </div>
                            <div className="loko-divider" />
                            <div>
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: "var(--text-3)",
                                        marginBottom: 8,
                                        fontFamily: "var(--font-mono)",
                                    }}
                                >
                                    Mono · 13px · var(--font-mono)
                                </div>
                                <div
                                    style={{
                                        fontFamily: "var(--font-mono)",
                                        fontSize: 13,
                                        background: "var(--code-bg)",
                                        padding: 12,
                                        borderRadius: 8,
                                        border: "1px solid var(--border)",
                                    }}
                                >
                                    chunk_size = 512 | top_k = 8 | reranker = bge-m3
                                </div>
                            </div>
                        </div>
                    </div>
                </Section>

                {/* Buttons */}
                <Section title="Buttons" subtitle="Primary, secondary, ghost variants with sizes">
                    <div className="loko-card" style={{ padding: 32 }}>
                        <div style={{ display: "grid", gap: 24 }}>
                            {/* Variants */}
                            <div>
                                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Variants</h4>
                                <div style={{ display: "flex", gap: 12 }}>
                                    <button className="btn btn-primary">Primary</button>
                                    <button className="btn btn-secondary">Secondary</button>
                                    <button className="btn btn-ghost">Ghost</button>
                                </div>
                            </div>

                            {/* Sizes */}
                            <div>
                                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Sizes</h4>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <button className="btn btn-lg btn-primary">Large</button>
                                    <button className="btn btn-primary">Default</button>
                                    <button className="btn btn-sm btn-primary">Small</button>
                                </div>
                            </div>

                            {/* Icon buttons */}
                            <div>
                                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
                                    Icon Buttons
                                </h4>
                                <div style={{ display: "flex", gap: 12 }}>
                                    <button className="btn-icon btn-primary">
                                        <Search size={18} />
                                    </button>
                                    <button className="btn-icon btn-secondary">
                                        <Settings size={18} />
                                    </button>
                                    <button className="btn-icon btn-sm btn-ghost">
                                        <Star size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </Section>

                {/* Badges */}
                <Section title="Badges" subtitle="Brand, neutral, warning, and mono variants">
                    <div className="loko-card" style={{ padding: 32 }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                            <span className="loko-badge loko-badge-brand">
                                <CheckCircle2 size={14} /> Active
                            </span>
                            <span className="loko-badge loko-badge-neutral">Pending</span>
                            <span className="loko-badge loko-badge-warn">Warning</span>
                            <span className="loko-badge loko-badge-mono">v1.4.44</span>
                            <span className="mono-tag">512 tokens</span>
                            <span className="mono-tag">0.87 cosine</span>
                        </div>
                    </div>
                </Section>

                {/* Cards */}
                <Section title="Cards" subtitle="Standard, selectable, and interactive cards">
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                        {[
                            { icon: Shield, title: "Sécurité", desc: "Données chiffrées localement" },
                            { icon: Zap, title: "Performance", desc: "Recherche ultra-rapide" },
                            { icon: Settings, title: "Configuration", desc: "Personnalisation complète" },
                        ].map((card, idx) => (
                            <button
                                key={idx}
                                className={`loko-card-select ${selectedCard === idx ? "active" : ""}`}
                                onClick={() => setSelectedCard(idx)}
                            >
                                {selectedCard === idx && (
                                    <CheckCircle2
                                        size={18}
                                        style={{
                                            position: "absolute",
                                            top: 16,
                                            right: 16,
                                            color: "var(--brand)",
                                        }}
                                    />
                                )}
                                <div className="loko-card-icon">
                                    <card.icon size={22} />
                                </div>
                                <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text)" }}>
                                    {card.title}
                                </div>
                                <div
                                    style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}
                                >
                                    {card.desc}
                                </div>
                            </button>
                        ))}
                    </div>
                </Section>

                {/* Forms */}
                <Section title="Forms" subtitle="Inputs, selects, and textareas">
                    <div className="loko-card" style={{ padding: 32 }}>
                        <div style={{ display: "grid", gap: 20, maxWidth: 480 }}>
                            <div>
                                <label className="field-label">Project Name</label>
                                <input
                                    className="input"
                                    type="text"
                                    placeholder="Enter project name"
                                />
                                <div className="field-hint">
                                    This name will be used in logs and exports
                                </div>
                            </div>

                            <div>
                                <label className="field-label">Model Selection</label>
                                <select className="select">
                                    <option>GPT-4o</option>
                                    <option>Claude 3.5 Sonnet</option>
                                    <option>Llama 3 (local)</option>
                                </select>
                            </div>

                            <div>
                                <label className="field-label">Description</label>
                                <textarea
                                    className="textarea"
                                    rows={3}
                                    placeholder="Describe your project..."
                                />
                            </div>
                        </div>
                    </div>
                </Section>

                {/* Toggle & Slider */}
                <Section title="Interactive Controls" subtitle="Toggle switches and sliders">
                    <div className="loko-card" style={{ padding: 32 }}>
                        <div style={{ display: "grid", gap: 32, maxWidth: 480 }}>
                            {/* Toggles */}
                            <div>
                                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
                                    Toggle Switches
                                </h4>
                                <div style={{ display: "grid", gap: 16 }}>
                                    <div className="set-row" style={{ padding: 0, border: "none" }}>
                                        <div className="meta">
                                            <div className="k">
                                                <Shield size={16} />
                                                PII Detection
                                            </div>
                                            <div className="v">
                                                Automatically anonymize sensitive data
                                            </div>
                                        </div>
                                        <div className="ctl">
                                            <Toggle checked={toggle1} onChange={setToggle1} />
                                        </div>
                                    </div>

                                    <div className="loko-divider" />

                                    <div className="set-row" style={{ padding: 0, border: "none" }}>
                                        <div className="meta">
                                            <div className="k">
                                                <Lock size={16} />
                                                Encryption
                                            </div>
                                            <div className="v">Encrypt logs and cached data</div>
                                        </div>
                                        <div className="ctl">
                                            <Toggle checked={toggle2} onChange={setToggle2} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Slider */}
                            <div>
                                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
                                    Slider
                                </h4>
                                <Slider
                                    value={sliderValue}
                                    min={128}
                                    max={2048}
                                    step={64}
                                    onChange={setSliderValue}
                                    label="Chunk Size"
                                    formatValue={(v) => `${v} tokens`}
                                />
                            </div>
                        </div>
                    </div>
                </Section>

                {/* Navigation */}
                <Section title="Navigation" subtitle="Sidebar nav items and status">
                    <div className="loko-card" style={{ padding: 32 }}>
                        <div style={{ maxWidth: 280 }}>
                            <div className="nav-brand" style={{ padding: "0 0 18px" }}>
                                <LokoGlyph size={28} />
                                <span className="wm">LOKO</span>
                            </div>
                            <div className="nav-section">Main</div>
                            <div className="nav-item active">
                                <Search size={18} />
                                <span className="lbl">Chat</span>
                                <span className="count">3</span>
                            </div>
                            <div className="nav-item">
                                <Settings size={18} />
                                <span className="lbl">Settings</span>
                            </div>
                            <div className="nav-section" style={{ marginTop: 20 }}>
                                Status
                            </div>
                            <div className="nav-status">
                                <div className="dot" />
                                <span>
                                    Backend <b>active</b>
                                </span>
                            </div>
                        </div>
                    </div>
                </Section>

                {/* Accordion */}
                <Section title="Accordion" subtitle="Expandable content sections">
                    <div className="acc open">
                        <div className="acc-head">
                            <div className="ic-box">
                                <Shield size={18} />
                            </div>
                            <div className="t">
                                <div className="name">Security Settings</div>
                                <div className="desc">Configure encryption and PII detection</div>
                            </div>
                            <ChevronDown className="chev" size={18} />
                        </div>
                        <div className="acc-body">
                            <p style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.5 }}>
                                LOKO provides multiple security layers to protect your data. Enable
                                PII detection to automatically redact sensitive information, and
                                encryption to secure all cached data.
                            </p>
                        </div>
                    </div>
                </Section>

                {/* Steps */}
                <Section title="Steps/Progress" subtitle="Wizard step indicators">
                    <div className="loko-card" style={{ padding: 32 }}>
                        <div className="steps">
                            <div className="s done">
                                <div className="n">1</div>
                                <span>Profile</span>
                            </div>
                            <div className="bar done" />
                            <div className="s active">
                                <div className="n">2</div>
                                <span>Sources</span>
                            </div>
                            <div className="bar" />
                            <div className="s">
                                <div className="n">3</div>
                                <span>Config</span>
                            </div>
                        </div>
                    </div>
                </Section>

                {/* Brand Elements */}
                <Section title="Brand Elements" subtitle="Logo variants and wordmark">
                    <div className="loko-card" style={{ padding: 40 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 32 }}>
                            <div style={{ textAlign: "center" }}>
                                <LokoGlyph size={64} />
                                <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 12 }}>
                                    Tile (default)
                                </div>
                            </div>
                            <div style={{ textAlign: "center" }}>
                                <LokoGlyph size={64} variant="house" />
                                <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 12 }}>
                                    House
                                </div>
                            </div>
                            <div style={{ textAlign: "center" }}>
                                <LokoGlyph size={64} variant="shield" />
                                <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 12 }}>
                                    Shield
                                </div>
                            </div>
                            <div style={{ textAlign: "center" }}>
                                <LokoGlyph size={64} mono />
                                <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 12 }}>
                                    Mono
                                </div>
                            </div>
                        </div>
                        <div className="loko-divider" style={{ margin: "32px 0" }} />
                        <div style={{ textAlign: "center" }}>
                            <Wordmark glyph={48} text={36} gap={16} />
                        </div>
                    </div>
                </Section>
            </div>
        </div>
    );
}

// Helper components
function Section({
    title,
    subtitle,
    children,
}: {
    title: string;
    subtitle: string;
    children: React.ReactNode;
}) {
    return (
        <section style={{ marginBottom: 48 }}>
            <div style={{ marginBottom: 18 }}>
                <h2
                    style={{
                        fontSize: 21,
                        fontWeight: 600,
                        letterSpacing: "-.02em",
                        color: "var(--text)",
                    }}
                >
                    {title}
                </h2>
                <p style={{ fontSize: 13.5, color: "var(--text-3)", marginTop: 4 }}>{subtitle}</p>
            </div>
            {children}
        </section>
    );
}

function ColorSwatch({ label, token }: { label: string; token: string }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
                style={{
                    width: 48,
                    height: 32,
                    borderRadius: 6,
                    background: `var(${token})`,
                    border: "1px solid var(--border)",
                }}
            />
            <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{label}</div>
                <div
                    style={{
                        fontSize: 11,
                        color: "var(--text-3)",
                        fontFamily: "var(--font-mono)",
                    }}
                >
                    {token}
                </div>
            </div>
        </div>
    );
}
