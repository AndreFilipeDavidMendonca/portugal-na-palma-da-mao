import React from "react";
import "./DistrictAsidePanel.scss";

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
    return (
        <aside className="right-panel gold-scroll">
            <div className="right-inner">
                <div className="district-header">
                    <div className="district-header-main">
                        {editing && isAdmin ? (
                            <input
                                className="district-name-input"
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
                                    <button
                                        type="button"
                                        className="district-btn district-btn--ghost"
                                        onClick={onCancel}
                                        disabled={saving}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        className="district-btn district-btn--primary"
                                        onClick={onSave}
                                        disabled={saving}
                                    >
                                        {saving ? "A guardar..." : "Guardar"}
                                    </button>
                                </>
                            ) : (
                                <button
                                    type="button"
                                    className="district-btn district-btn--ghost"
                                    onClick={onEdit}
                                >
                                    Editar
                                </button>
                            )
                        )}
                    </div>
                </div>

                <div className="district-header-subrow">
                    <button type="button" className="district-videos-toggle" onClick={onToggleGallery}>
                        {showGallery ? "Fechar galeria" : "Galeria"}
                    </button>
                </div>

                {error && <div className="district-error">{error}</div>}

                <div className="district-info">
                    <div className="district-meta">
                        <div>
                            <strong>População:</strong>{" "}
                            {editing && isAdmin ? (
                                <input
                                    className="district-meta-input"
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
                                <input
                                    className="district-meta-input"
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
                                <input
                                    className="district-meta-input"
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
                                <input
                                    className="district-meta-input"
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
                                <textarea
                                    className="district-textarea"
                                    rows={4}
                                    value={distDescription}
                                    onChange={(e) => setDistDescription(e.target.value)}
                                />

                                <label className="district-label">História</label>
                                <textarea
                                    className="district-textarea"
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
                                    <p className="district-description">Sem informação detalhada para este distrito (ainda).</p>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </aside>
    );
}