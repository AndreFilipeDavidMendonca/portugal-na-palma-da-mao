// src/pages/pois/CreatePoiPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    createPoi,
    fetchDistricts,
    geocodeAddress,
    type DistrictDto,
    type GeocodeRequestDto,
} from "@/lib/api";
import { useAuth } from "@/auth/AuthContext";
import ImageDropField from "@/components/ImageDropField";
import "./CreatePoiPage.scss";

type Category = "Evento" | "Artesanato" | "Gastronomia" | "Alojamento";

export default function CreatePoiPage() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const canCreate = user?.role === "BUSINESS" || user?.role === "ADMIN";

    const [name, setName] = useState("");
    const [category, setCategory] = useState<Category>("Evento");
    const [description, setDescription] = useState("");

    // Morada
    const [street, setStreet] = useState("");
    const [houseNumber, setHouseNumber] = useState("");
    const [postalCode, setPostalCode] = useState("");

    // Município (Concelho) -> obrigatório p/ geocode
    const [municipality, setMunicipality] = useState("");

    // Distrito -> select
    const [districts, setDistricts] = useState<DistrictDto[]>([]);
    const [districtId, setDistrictId] = useState<number | "">("");

    // Geo
    const [lat, setLat] = useState<number | null>(null);
    const [lon, setLon] = useState<number | null>(null);
    const [geoStatus, setGeoStatus] = useState<string | null>(null);
    const [geoLoading, setGeoLoading] = useState(false);

    const [images, setImages] = useState<string[]>([]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!canCreate) navigate("/");
    }, [canCreate, navigate]);

    // Carregar distritos para o select
    useEffect(() => {
        if (!canCreate) return;
        (async () => {
            try {
                const list = await fetchDistricts();
                setDistricts(list ?? []);
            } catch {
                // se falhar não bloqueia, mas o districtId ficará por preencher
                setDistricts([]);
            }
        })();
    }, [canCreate]);

    const selectedDistrictName = useMemo(() => {
        if (districtId === "") return "";
        const d = districts.find((x) => x.id === districtId);
        return d?.namePt ?? d?.name ?? "";
    }, [districtId, districts]);

    /* ===========================
       Geocode automático (debounce)
       Só corre quando:
       - concelho (municipality) está preenchido
       - e rua está preenchida
    =========================== */

    const addressKey = useMemo(
        () =>
            `${street}|${houseNumber}|${postalCode}|${municipality}|${selectedDistrictName}`,
        [street, houseNumber, postalCode, municipality, selectedDistrictName]
    );

    useEffect(() => {
        // ✅ regra: só chama geocode quando concelho está preenchido
        if (!street.trim()) return;
        if (!municipality.trim()) return;

        const timer = setTimeout(async () => {
            const req: GeocodeRequestDto = {
                street: street.trim(),
                houseNumber: houseNumber.trim() || undefined,
                postalCode: postalCode.trim() || undefined,

                // city = concelho
                city: municipality.trim(),

                // district = nome do distrito (para ajudar)
                district: selectedDistrictName || undefined,

                country: "Portugal",
            };

            try {
                setGeoLoading(true);
                setGeoStatus("A localizar morada…");

                const res = await geocodeAddress(req);

                setLat(res.lat);
                setLon(res.lon);
                setGeoStatus(
                    `Localizado ✅ (confiança ${(res.confidence * 100).toFixed(0)}%)`
                );
            } catch {
                setLat(null);
                setLon(null);
                setGeoStatus("Não foi possível localizar a morada");
            } finally {
                setGeoLoading(false);
            }
        }, 900);

        return () => clearTimeout(timer);
    }, [addressKey]);

    /* ===========================
       Submit
    =========================== */

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (loading) return;

        setError(null);

        if (!name.trim()) return setError("Nome é obrigatório.");
        if (!districtId) return setError("Seleciona o distrito.");
        if (!municipality.trim()) return setError("Concelho é obrigatório.");
        if (!street.trim()) return setError("Rua é obrigatória.");
        if (!lat || !lon) return setError("Morada não localizada.");
        if (images.length === 0) return setError("Adiciona pelo menos uma imagem.");

        setLoading(true);

        try {
            const { id } = await createPoi({
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

            // ✅ navega para detalhe do POI
            navigate(`/pois/${id}`);
        } catch (e: any) {
            setError(e?.message ?? "Falha ao criar POI");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="create-poi-page">
            <div className="create-poi-card">
                <h2 className="create-poi-title">Criar POI Comercial</h2>

                <form onSubmit={onSubmit} className="create-poi-form">
                    <input
                        className="create-poi-input"
                        placeholder="Nome"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={loading}
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

                    {/* ✅ Distrito select */}
                    <select
                        className="create-poi-input"
                        value={districtId}
                        onChange={(e) =>
                            setDistrictId(e.target.value ? Number(e.target.value) : "")
                        }
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
                        />

                        <input
                            placeholder="Rua (obrigatória)"
                            value={street}
                            onChange={(e) => setStreet(e.target.value)}
                            disabled={loading}
                        />

                        <input
                            placeholder="Nº"
                            value={houseNumber}
                            onChange={(e) => setHouseNumber(e.target.value)}
                            disabled={loading}
                        />

                        <input
                            placeholder="Código Postal"
                            value={postalCode}
                            onChange={(e) => setPostalCode(e.target.value)}
                            disabled={loading}
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
                        <button
                            className="create-poi-btn create-poi-btn--primary"
                            disabled={loading || geoLoading}
                        >
                            {loading ? "A criar…" : "Criar POI"}
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