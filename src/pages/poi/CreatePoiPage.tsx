import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import ImageDropField from "@/components/ImageDropField/ImageDropField";
import { toast } from "@/components/Toastr/toast";
import "./CreatePoiPage.scss";
import {createPoi, DistrictDto, fetchDistricts, geocodeAddress, GeocodeRequestDto} from "@/lib/api";
import Button from "@/components/Button/Button";
import Input from "@/components/Input/TextField/Input";
import Textarea from "@/components/Input/TextArea/Textarea";
import Select from "@/components/Input/Select/Select";

type Category = "event" | "crafts" | "gastronomy" | "accommodation";

const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
    { value: "event", label: "Evento" },
    { value: "crafts", label: "Artesanato" },
    { value: "gastronomy", label: "Gastronomia" },
    { value: "accommodation", label: "Alojamento" },
];

type FieldKey = "name" | "districtId" | "municipality" | "street" | "latlon" | "images";
type FieldErrors = Partial<Record<FieldKey, string>>;

const ALL_FIELDS: FieldKey[] = ["name", "districtId", "municipality", "street", "latlon", "images"];

export default function CreatePoiPage() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const canCreate = user?.role === "BUSINESS" || user?.role === "ADMIN";

    const [name, setName] = useState("");
    const [category, setCategory] = useState<Category>("event");
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

    const [errors, setErrors] = useState<FieldErrors>({});
    const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});

    const aliveRef = useRef(true);
    useEffect(() => {
        aliveRef.current = true;
        return () => {
            aliveRef.current = false;
        };
    }, []);

    useEffect(() => {
        if (user == null) return;
        if (!canCreate) navigate("/");
    }, [user, canCreate, navigate]);

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

    const setFieldTouched = (field: FieldKey) => {
        setTouched((p) => ({ ...p, [field]: true }));
    };

    const clearFieldError = (field: FieldKey) => {
        setErrors((p) => {
            if (!p[field]) return p;
            const { [field]: _removed, ...rest } = p;
            return rest;
        });
    };

    const isInvalid = (field: FieldKey) => Boolean(touched[field] && errors[field]);

    const validateForm = (): FieldErrors => {
        const next: FieldErrors = {};

        if (!name.trim()) next.name = "Nome é obrigatório.";
        if (!districtId) next.districtId = "Seleciona o distrito.";
        if (!municipality.trim()) next.municipality = "Concelho é obrigatório.";
        if (!street.trim()) next.street = "Rua é obrigatória.";
        if (lat == null || lon == null) next.latlon = "Morada não localizada.";
        if (images.length === 0) next.images = "Adiciona pelo menos uma imagem.";

        return next;
    };

    const showValidationToasts = (nextErrors: FieldErrors) => {
        for (const msg of Object.values(nextErrors)) {
            if (msg) toast.error(msg);
        }
    };

    const addressKey = useMemo(
        () => `${street}|${houseNumber}|${postalCode}|${municipality}|${selectedDistrictName}`,
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

                clearFieldError("latlon");
            } catch {
                if (!aliveRef.current) return;
                setLat(null);
                setLon(null);
                setGeoStatus("Não foi possível localizar a morada");

                // só marca erro no campo se o user já tocou ou se já tentou submeter
                setErrors((p) => ({ ...p, latlon: "Morada não localizada." }));
            } finally {
                setGeoLoading(false);
            }
        }, 900);

        return () => clearTimeout(timer);
    }, [addressKey, loading, street, municipality, houseNumber, postalCode, selectedDistrictName]); // ok

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (loading) return;

        const nextErrors = validateForm();

        setTouched((t) => ({
            ...t,
            ...Object.fromEntries(ALL_FIELDS.map((k) => [k, true])),
        }));
        setErrors(nextErrors);

        if (Object.keys(nextErrors).length > 0) {
            showValidationToasts(nextErrors);
            return;
        }

        // Aqui o TS já não “acredita”, então fechamos com guard tipado
        const latN = lat;
        const lonN = lon;
        if (latN == null || lonN == null) {
            setErrors((p) => ({ ...p, latlon: "Morada não localizada." }));
            toast.error("Morada não localizada.");
            return;
        }

        setLoading(true);

        try {
            const created = await createPoi({
                name: name.trim(),
                category,
                description: description.trim() || null,
                districtId: Number(districtId),
                municipality: municipality.trim(),
                lat: latN,
                lon: lonN,
                image: images[0],
                images,
            });

            toast.success("POI criado com sucesso.");
            window.dispatchEvent(new CustomEvent("pt:open-poi", { detail: { poiId: created.id } }));
            navigate("/");
        } catch (err: any) {
            toast.error(err?.message ?? "Falha ao criar POI");
        } finally {
            if (aliveRef.current) setLoading(false);
        }
    }
    console.log("creating poi images:", images);
    return (
        <div className="create-poi-page">
            <div className="create-poi-card gold-scroll">
                <h2 className="create-poi-title">Criar ponto Comercial</h2>

                <form onSubmit={onSubmit} className="create-poi-form">
                    <Input
                        placeholder="Nome"
                        value={name}
                        onBlur={() => setFieldTouched("name")}
                        onChange={(e) => {
                            setName(e.target.value);
                            clearFieldError("name");
                        }}
                        disabled={loading}
                        autoComplete="off"
                        invalid={isInvalid("name")}
                        variant="panel"
                        size="md"
                    />

                    <Select
                        variant="panel"
                        value={category}
                        onChange={(e) => setCategory(e.target.value as Category)}
                        disabled={loading}
                    >
                        {CATEGORY_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </Select>

                    <Textarea
                        placeholder="Descrição"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        disabled={loading}
                        variant="panel"
                        size="md"
                    />

                    <Select
                        variant="panel"
                        invalid={isInvalid("districtId")}
                        value={districtId}
                        onBlur={() => setFieldTouched("districtId")}
                        onChange={(e) => {
                            setDistrictId(e.target.value ? Number(e.target.value) : "");
                            clearFieldError("districtId");
                        }}
                        disabled={loading}
                    >
                        <option value="">Seleciona o distrito…</option>
                        {districts.map((d) => (
                            <option key={d.id} value={d.id}>
                                {d.namePt ?? d.name}
                            </option>
                        ))}
                    </Select>

                    <div className="create-poi-grid">
                        <Input
                            placeholder="Concelho (obrigatório)"
                            value={municipality}
                            onBlur={() => setFieldTouched("municipality")}
                            onChange={(e) => { setMunicipality(e.target.value); clearFieldError("municipality"); }}
                            disabled={loading}
                            autoComplete="address-level2"
                            invalid={isInvalid("municipality")}
                            variant="panel"
                            size="md"
                        />

                        <Input
                            placeholder="Rua (obrigatória)"
                            value={street}
                            onBlur={() => setFieldTouched("street")}
                            onChange={(e) => { setStreet(e.target.value); clearFieldError("street"); }}
                            disabled={loading}
                            autoComplete="street-address"
                            invalid={isInvalid("street")}
                            variant="panel"
                            size="md"
                        />

                        <Input
                            placeholder="Nº"
                            value={houseNumber}
                            onChange={(e) => setHouseNumber(e.target.value)}
                            disabled={loading}
                            inputMode="numeric"
                            autoComplete="address-line2"
                            variant="panel"
                            size="md"
                        />

                        <Input
                            placeholder="Código Postal"
                            value={postalCode}
                            onChange={(e) => setPostalCode(e.target.value)}
                            disabled={loading}
                            inputMode="numeric"
                            autoComplete="postal-code"
                            variant="panel"
                            size="md"
                        />
                    </div>

                    {geoStatus && (
                        <div className={`create-poi-geo ${isInvalid("latlon") ? "is-invalid-text" : ""}`}>
                            {geoStatus}
                        </div>
                    )}

                    <div className={isInvalid("images") ? "is-invalid-block" : ""}>
                        <ImageDropField
                            label="Imagens do POI"
                            images={images}
                            onChange={(list) => {
                                setImages(list.slice(0, 6));
                                clearFieldError("images");
                                setFieldTouched("images");
                            }}
                            mode="media"
                            maxItems={10}
                        />
                    </div>

                    <div className="create-poi-actions">
                        <Button variant="primary" pill strong disabled={loading || geoLoading}>
                            {loading ? "A criar…" : "Criar"}
                        </Button>

                        <Button
                            type="button"
                            variant="ghost"
                            pill
                            strong
                            onClick={() => navigate("/")}
                            disabled={loading}
                        >
                            Cancelar
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}