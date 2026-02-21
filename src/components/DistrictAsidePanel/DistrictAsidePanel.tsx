// src/components/DistrictAsidePanel/DistrictAsidePanel.tsx
import React from "react";
import "./DistrictAsidePanel.scss";
import { toast } from "@/components/Toastr/toast";
import Button from "@/components/Button/Button";
import Input from "@/components/Input/TextField/Input";
import Textarea from "@/components/Input/TextArea/Textarea";

type Props = {
    showGallery: boolean;
    onToggleGallery: () => void;

    isAdmin: boolean;
    editing: boolean;
    saving: boolean;
    error: string | null;

    onEdit: () => void;
    onSave: () => void;
    onCancel: () => void;

    districtNameFallback: string;

    distName: string;
    setDistName: (v: string) => void;

    /** ✅ NOVO */
    distMedia: string[];
    setDistMedia: (v: string[]) => void;

    distPopulation: string;
    setDistPopulation: (v: string) => void;

    distMunicipalities: string;
    setDistMunicipalities: (v: string) => void;

    distParishes: string;
    setDistParishes: (v: string) => void;

    distInhabitedSince: string;
    setDistInhabitedSince: (v: string) => void;

    distDescription: string;
    setDistDescription: (v: string) => void;

    distHistory: string;
    setDistHistory: (v: string) => void;
};

export default function DistrictAsidePanel({
                                               showGallery,
                                               onToggleGallery,
                                               isAdmin,
                                               editing,
                                               saving,
                                               error,
                                               onEdit,
                                               onSave,
                                               onCancel,
                                               districtNameFallback,
                                               distName,
                                               setDistName,
                                               distPopulation,
                                               setDistPopulation,
                                               distMunicipalities,
                                               setDistMunicipalities,
                                               distParishes,
                                               setDistParishes,
                                               distInhabitedSince,
                                               setDistInhabitedSince,
                                               distDescription,
                                               setDistDescription,
                                               distHistory,
                                               setDistHistory,
                                           }: Props) {

    const lastErrRef = React.useRef<string | null>(null);
    React.useEffect(() => {
        if (!error) return;
        if (lastErrRef.current === error) return;
        lastErrRef.current = error;
        toast.error(error);
    }, [error]);

    return (
        <aside className="right-panel gold-scroll">
            <div className="right-inner">
                <div className="district-header">
                    <div className="district-header-main">
                        {editing && isAdmin ? (
                            <Input
                                variant="title"
                                size="md"
                                fullWidth={false}
                                value={distName}
                                onChange={(e) => setDistName(e.target.value)}
                            />
                        ) : (
                            <h1 className="district-title">
                                <strong>{distName || districtNameFallback}</strong>
                            </h1>
                        )}
                    </div>

                    <div className="district-header-actions">
                        {showGallery && isAdmin && (
                            editing ? (
                                <>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="xs"
                                        pill
                                        onClick={onCancel}
                                        disabled={saving}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="primary"
                                        size="xs"
                                        pill
                                        onClick={onSave}
                                        disabled={saving}
                                    >
                                        {saving ? "A guardar..." : "Guardar"}
                                    </Button>
                                </>
                            ) : (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="xs"
                                    pill
                                    onClick={onEdit}
                                >
                                    Editar
                                </Button>
                            )
                        )}
                    </div>
                </div>

                <div className="district-header-subrow">
                    <Button type="button" variant="ghost" size="xs" pill onClick={onToggleGallery}>
                        {showGallery ? "Fechar galeria" : "Galeria"}
                    </Button>
                </div>

                <div className="district-info">
                    <div className="district-meta">
                        <div>
                            <strong>População:</strong>{" "}
                            {editing && isAdmin ? (
                                <Input
                                    size="xs"
                                    pill
                                    css={{ minWidth: 60 }}
                                    value={distPopulation}
                                    onChange={(e) => setDistPopulation(e.target.value)}
                                />
                            ) : (
                                distPopulation || "—"
                            )}
                        </div>

                        <div>
                            <strong>Concelhos:</strong>{" "}
                            {editing && isAdmin ? (
                                <Input
                                    size="xs"
                                    pill
                                    css={{ minWidth: 60 }}
                                    value={distMunicipalities}
                                    onChange={(e) => setDistMunicipalities(e.target.value)}
                                />
                            ) : (
                                distMunicipalities || "—"
                            )}
                        </div>

                        <div>
                            <strong>Freguesias:</strong>{" "}
                            {editing && isAdmin ? (
                                <Input
                                    size="xs"
                                    pill
                                    css={{ minWidth: 60 }}
                                    value={distParishes}
                                    onChange={(e) => setDistParishes(e.target.value)}
                                />
                            ) : (
                                distParishes || "—"
                            )}
                        </div>

                        <div>
                            <strong>Habitado desde:</strong>{" "}
                            {editing && isAdmin ? (
                                <Input
                                    size="xs"
                                    pill
                                    css={{ minWidth: 60 }}
                                    value={distInhabitedSince}
                                    onChange={(e) => setDistInhabitedSince(e.target.value)}
                                />
                            ) : (
                                distInhabitedSince || "—"
                            )}
                        </div>
                    </div>

                    <div className="district-text-blocks">
                        {editing && isAdmin ? (
                            <>
                                <label className="district-label">Descrição</label>
                                <Textarea
                                    variant="panel"
                                    size="sm"
                                    rows={4}
                                    value={distDescription}
                                    onChange={(e) => setDistDescription(e.target.value)}
                                />

                                <label className="district-label">História</label>
                                <Textarea
                                    variant="panel"
                                    size="sm"
                                    rows={6}
                                    value={distHistory}
                                    onChange={(e) => setDistHistory(e.target.value)}
                                />
                            </>
                        ) : (
                            <>
                                {distDescription && <p className="district-description">{distDescription}</p>}
                                {distHistory && <p className="district-history">{distHistory}</p>}
                                {!distDescription && !distHistory && (
                                    <p className="district-description">
                                        Sem informação detalhada para este distrito (ainda).
                                    </p>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </aside>
    );
}