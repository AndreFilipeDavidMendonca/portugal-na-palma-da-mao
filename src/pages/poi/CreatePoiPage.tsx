// src/pages/pois/CreatePoiPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    createPoi,
    fetchDistricts,
    geocodeAddress,
    type DistrictDto,
    type GeocodeRequestDto,
} from "@/lib/api";
import { useAuth } from "@/auth/AuthContext";
import ImageDropField from "@/components/ImageDropField/ImageDropField";
import "./CreatePoiPage.scss";

type Category = "Evento" | "Artesanato" | "Gastronomia" | "Alojamento";

export default function CreatePoiPage() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const canCreate = user?.role === "BUSINESS" || user?.role === "ADMIN";

    /* ---------------- Form state ---------------- */

    const [name, setName] = useState("");
    const [category, setCategory] = useState<Category>("Evento");
    const [description, setDescription] = useState("");

    const [street, setStreet] = useState("");
    const [houseNumber, setHouseNumber] = useState("");
    const [postalCode, setPostalCode] = useState("");
    const [municipality, setMunicipality] = useState("");

    const [districts, setDistricts] = useState<DistrictDto[]>([]);
    const [districtId, setDistrictId] = useState<number | "">("");

    const [lat, setLat] = useState<number | null>(null);
    const [lon, setLon] = useState<number | null>(null);
    const [geoStatus, setGeoStatus] = useState<string | null>(null);
    const [geoLoading, setGeoLoading] = useState(false);

    const [images, setImages] = useState<string[]>([]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /* ---------------- Lifecycle guards ---------------- */

    const aliveRef = useRef(true);
    useEffect(() => {
        aliveRef.current = true;
        return () => {
            aliveRef.current = false;
        };
    }, []);

    /* ---------------- Permissions ---------------- */

    useEffect(() => {
        if (user == null) return;
        if (!canCreate) navigate("/");
    }, [user, canCreate, navigate]);

    /* ---------------- Districts ---------------- */

    useEffect(() => {
        if (!canCreate) return;

        (async () => {
            try {
                const list = await fetchDistricts();
                if (!aliveRef.current) return;
                setDistricts(list ?? []);
            } catch {
                if (!aliveRef.current) return;
                setDistricts([]);
            }
        })();
    }, [canCreate]);

    const selectedDistrictName = useMemo(() => {
        if (districtId === "") return "";
        const d = districts.find((x) => x.id === districtId);
        return d?.namePt ?? d?.name ?? "";
    }, [districtId, districts]);

    /* ---------------- Geocode (debounced) ---------------- */

    const addressKey = useMemo(
        () =>
            `${street}|${houseNumber}|${postalCode}|${municipality}|${selectedDistrictName}`,
        [street, houseNumber, postalCode, municipality, selectedDistrictName]
    );

    useEffect(() => {
        if (loading) return;
        if (!street.trim() || !municipality.trim()) return;

        const timer = setTimeout(async () => {
            const req: GeocodeRequestDto = {
                street: street.trim(),
                houseNumber: houseNumber.trim() || undefined,
                postalCode: postalCode.trim() || undefined,
                city: municipality.trim(),
                district: selectedDistrictName || undefined,
                country: "Portugal",
            };

            try {
                if (!aliveRef.current) return;
                setGeoLoading(true);
                setGeoStatus("A localizar morada…");

                const res = await geocodeAddress(req);

                if (!aliveRef.current) return;
                setLat(res.lat);
                setLon(res.lon);
                setGeoStatus(`Localizado ✅ (${Math.round(res.confidence * 100)}%)`);
            } catch {
                if (!aliveRef.current) return;
                setLat(null);
                setLon(null);
                setGeoStatus("Não foi possível localizar a morada");
            } finally {
                if (!aliveRef.current) return;
                setGeoLoading(false);
            }
        }, 900);

        return () => clearTimeout(timer);
    }, [addressKey, loading, street, municipality, houseNumber, postalCode, selectedDistrictName]);

    /* ---------------- Submit ---------------- */

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (loading) return;

        setError(null);

        if (!name.trim()) return setError("Nome é obrigatório.");
        if (!districtId) return setError("Seleciona o distrito.");
        if (!municipality.trim()) return setError("Concelho é obrigatório.");
        if (!street.trim()) return setError("Rua é obrigatória.");
        if (lat == null || lon == null) return setError("Morada não localizada.");
        if (images.length === 0) return setError("Adiciona pelo menos uma imagem.");

        setLoading(true);

        try {
            const created = await createPoi({
                name: name.trim(),
                category,
                description: description.trim() || null,
                districtId: Number(districtId),
                municipality: municipality.trim(),
                lat,
                lon,
                image: images[0],
                images,
            });

            window.dispatchEvent(
                new CustomEvent("pt:open-poi", { detail: { poiId: created.id } })
            );

            navigate("/");
        } catch (e: any) {
            setError(e?.message ?? "Falha ao criar POI");
        } finally {
            if (aliveRef.current) setLoading(false);
        }
    }

    /* ---------------- Render ---------------- */

    return (
        <div className="create-poi-page">
            <div className="create-poi-card">
                <h2 className="create-poi-title">Criar ponto Comercial</h2>

                <form onSubmit={onSubmit} className="create-poi-form">
                    <input
                        className="create-poi-input"
                        placeholder="Nome"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={loading}
                        autoComplete="off"
                    />

                    <select
                        className="create-poi-input"
                        value={category}
                        onChange={(e) => setCategory(e.target.value as Category)}
                        disabled={loading}
                    >
                        <option>Evento</option>
                        <option>Artesanato</option>
                        <option>Gastronomia</option>
                        <option>Alojamento</option>
                    </select>

                    <textarea
                        className="create-poi-textarea"
                        placeholder="Descrição"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        disabled={loading}
                    />

                    <select
                        className="create-poi-input"
                        value={districtId}
                        onChange={(e) => setDistrictId(e.target.value ? Number(e.target.value) : "")}
                        disabled={loading}
                    >
                        <option value="">Seleciona o distrito…</option>
                        {districts.map((d) => (
                            <option key={d.id} value={d.id}>
                                {d.namePt ?? d.name}
                            </option>
                        ))}
                    </select>

                    <div className="create-poi-grid">
                        <input
                            placeholder="Concelho (obrigatório)"
                            value={municipality}
                            onChange={(e) => setMunicipality(e.target.value)}
                            disabled={loading}
                            autoComplete="address-level2"
                        />

                        <input
                            placeholder="Rua (obrigatória)"
                            value={street}
                            onChange={(e) => setStreet(e.target.value)}
                            disabled={loading}
                            autoComplete="street-address"
                        />

                        <input
                            placeholder="Nº"
                            value={houseNumber}
                            onChange={(e) => setHouseNumber(e.target.value)}
                            disabled={loading}
                            inputMode="numeric"
                            autoComplete="address-line2"
                        />

                        <input
                            placeholder="Código Postal"
                            value={postalCode}
                            onChange={(e) => setPostalCode(e.target.value)}
                            disabled={loading}
                            inputMode="numeric"
                            autoComplete="postal-code"
                        />
                    </div>

                    {geoStatus && <div className="create-poi-geo">{geoStatus}</div>}

                    <ImageDropField
                        label="Imagens do POI"
                        images={images}
                        onChange={(list) => setImages(list.slice(0, 6))}
                        mode="image"
                    />

                    {error && <div className="create-poi-error">{error}</div>}

                    <div className="create-poi-actions">
                        <button className="create-poi-btn create-poi-btn--primary" disabled={loading || geoLoading}>
                            {loading ? "A criar…" : "Criar"}
                        </button>

                        <button
                            type="button"
                            className="create-poi-btn create-poi-btn--ghost"
                            onClick={() => navigate("/")}
                            disabled={loading}
                        >
                            Cancelar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}