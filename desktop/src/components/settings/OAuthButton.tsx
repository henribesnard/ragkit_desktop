import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ipc } from "@/lib/ipc";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

interface OAuthButtonProps {
    provider: "google" | "microsoft" | "dropbox";
    sourceId?: string;
    connected?: boolean;
    onConnected?: () => void;
}

export function OAuthButton({ provider, sourceId, connected, onConnected }: OAuthButtonProps) {
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleConnect = async () => {
        if (!sourceId) {
            setError("Enregistrez la source avant de connecter.");
            return;
        }
        setError(null);
        setPending(true);
        try {
            const res = await ipc.startSourceOAuth(sourceId, provider);
            const authUrl = res?.auth_url;
            if (!authUrl) {
                throw new Error("URL d'authentification indisponible");
            }
            try {
                new WebviewWindow(`oauth-${provider}-${sourceId}`, {
                    url: authUrl,
                    title: `Connexion ${provider}`,
                    width: 720,
                    height: 900,
                });
            } catch {
                window.open(authUrl, "_blank");
            }
        } catch (err: any) {
            setError(err?.toString() || "Erreur OAuth");
            setPending(false);
        }
    };

    const handleVerify = async () => {
        if (onConnected) {
            await onConnected();
        }
        setPending(false);
    };

    const handleRevoke = async () => {
        if (!sourceId) return;
        try {
            await ipc.revokeSourceOAuth(sourceId);
            if (onConnected) {
                await onConnected();
            }
        } catch (err: any) {
            setError(err?.toString() || "Erreur de deconnexion");
        }
    };

    if (connected) {
        return (
            <div className="flex items-center gap-3">
                <span className="text-sm text-emerald-600 font-semibold">Connecte ✓</span>
                <Button variant="outline" onClick={handleRevoke} type="button">
                    Deconnexion
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-3">
                <Button onClick={handleConnect} type="button" disabled={pending}>
                    Se connecter
                </Button>
                {pending && (
                    <Button variant="outline" onClick={handleVerify} type="button">
                        Verifier la connexion
                    </Button>
                )}
            </div>
            {error && <div className="text-xs text-red-500">{error}</div>}
        </div>
    );
}

