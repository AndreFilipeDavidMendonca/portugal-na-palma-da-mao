import { POI_CATEGORIES, PoiCategory } from "@/utils/constants";

type Props = {
    selected: Set<PoiCategory>;
    onToggle: (k: PoiCategory) => void;
    onClear: () => void;
};

export default function PoiFilter({ selected, onToggle, onClear }: Props) {
    return (
        <div
            style={{
                position: "absolute",
                top: 72,
                left: 12,
                zIndex: 1000,
                background: "rgba(255,255,255,0.95)",
                borderRadius: 12,
                padding: 12,
                boxShadow: "0 6px 16px rgba(0,0,0,0.15)",
                width: 260
            }}
        >
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Pontos de interesse</div>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
                Seleciona tipos para carregar (nada selecionado = sem POIs).
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {POI_CATEGORIES.map((c) => (
                    <label key={c.key} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input
                            type="checkbox"
                            checked={selected.has(c.key)}
                            onChange={() => onToggle(c.key)}
                        />
                        <span>{c.label}</span>
                    </label>
                ))}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
                <button
                    onClick={onClear}
                    style={{ border: "1px solid #ddd", background: "#fff", padding: "6px 10px", borderRadius: 8 }}
                >
                    Limpar
                </button>
                <span style={{ fontSize: 12, color: "#333" }}>
          {selected.size} tipo{selected.size === 1 ? "" : "s"} selecionado{selected.size === 1 ? "" : "s"}
        </span>
            </div>
        </div>
    );
}