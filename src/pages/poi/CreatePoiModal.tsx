import ReactDOM from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import ImageDropField from "@/components/ImageDropField/ImageDropField";
import { toast } from "@/components/Toastr/toast";
import "./CreatePoiModal.scss";
import {
  createPoi,
  DistrictDto,
  fetchDistricts,
  geocodeAddress,
  GeocodeRequestDto,
} from "@/lib/api";
import Button from "@/components/Button/Button";
import Input from "@/components/Input/TextField/Input";
import Textarea from "@/components/Input/TextArea/Textarea";
import Select from "@/components/Input/Select/Select";

type Props = {
  open: boolean;
  onClose: () => void;
};

type Category = "event" | "crafts" | "gastronomy" | "accommodation";
type Step = 1 | 2 | 3;

type FieldKey =
  | "name"
  | "districtId"
  | "municipality"
  | "street"
  | "houseNumber"
  | "postalCode"
  | "latlon"
  | "images";

type FieldErrors = Partial<Record<FieldKey, string>>;

const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: "event", label: "Evento" },
  { value: "crafts", label: "Artesanato" },
  { value: "gastronomy", label: "Gastronomia" },
  { value: "accommodation", label: "Alojamento" },
];

const STEP_FIELDS: Record<Step, FieldKey[]> = {
  1: ["name"],
  2: ["districtId", "municipality", "street", "houseNumber", "postalCode", "latlon"],
  3: ["images"],
};

function stripNameHash(url: string) {
  return url.split("#")[0];
}

function normalizePostalCode(value: string) {
  return value.replace(/[^\d-]/g, "").trim();
}

function getStepTitle(step: Step) {
  if (step === 1) return "Negócio";
  if (step === 2) return "Morada";
  return "Imagens";
}

function getStepSubtitle(step: Step) {
  if (step === 1) return "Define o nome, tipo e descrição do negócio.";
  if (step === 2) return "Indica a morada para localizar o negócio com precisão.";
  return "Adiciona imagens com pré-visualização antes de guardar.";
}

export default function CreatePoiModal({ open, onClose }: Props) {
  const { user } = useAuth();
  const canCreate = user?.role === "BUSINESS" || user?.role === "ADMIN";

  const [step, setStep] = useState<Step>(1);

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
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);
  const [imagesUploading, setImagesUploading] = useState(false);

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
    if (!open || !canCreate) return;

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
  }, [open, canCreate]);

  useEffect(() => {
    if (!open) return;

    setStep(1);
    setName("");
    setCategory("event");
    setDescription("");
    setStreet("");
    setHouseNumber("");
    setPostalCode("");
    setMunicipality("");
    setDistrictId("");
    setLat(null);
    setLon(null);
    setGeoStatus(null);
    setGeoLoading(false);
    setImages([]);
    setSelectedPreview(null);
    setImagesUploading(false);
    setLoading(false);
    setErrors({});
    setTouched({});
  }, [open]);

  useEffect(() => {
    if (images.length === 0) {
      setSelectedPreview(null);
      return;
    }

    if (!selectedPreview || !images.includes(selectedPreview)) {
      setSelectedPreview(images[0]);
    }
  }, [images, selectedPreview]);

  const selectedDistrictName = useMemo(() => {
    if (districtId === "") return "";
    const district = districts.find((item) => item.id === districtId);
    return district?.namePt ?? district?.name ?? "";
  }, [districtId, districts]);

  const hasDraft =
    name.trim().length > 0 ||
    description.trim().length > 0 ||
    street.trim().length > 0 ||
    houseNumber.trim().length > 0 ||
    postalCode.trim().length > 0 ||
    municipality.trim().length > 0 ||
    Boolean(districtId) ||
    images.length > 0;

  const addressKey = useMemo(
    () => `${street}|${houseNumber}|${postalCode}|${municipality}|${selectedDistrictName}`,
    [street, houseNumber, postalCode, municipality, selectedDistrictName]
  );

  const setFieldTouched = (field: FieldKey) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const markFieldsTouched = (fields: FieldKey[]) => {
    setTouched((prev) => ({
      ...prev,
      ...Object.fromEntries(fields.map((field) => [field, true])),
    }));
  };

  const clearFieldError = (field: FieldKey) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const { [field]: _removed, ...rest } = prev;
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
    if (!houseNumber.trim()) next.houseNumber = "Número da porta é obrigatório.";
    if (!postalCode.trim()) next.postalCode = "Código postal é obrigatório.";
    if (lat == null || lon == null) next.latlon = "Morada não localizada.";
    if (images.length === 0) next.images = "Adiciona pelo menos uma imagem.";

    return next;
  };

  const validateStep = (currentStep: Step): FieldErrors => {
    const nextErrors = validateForm();
    const allowedFields = STEP_FIELDS[currentStep];

    return Object.fromEntries(
      Object.entries(nextErrors).filter(([key]) => allowedFields.includes(key as FieldKey))
    ) as FieldErrors;
  };

  const showValidationToasts = (nextErrors: FieldErrors) => {
    for (const msg of Object.values(nextErrors)) {
      if (msg) toast.error(msg);
    }
  };

  useEffect(() => {
    if (!open || loading) return;

    const hasAddress =
      street.trim() &&
      houseNumber.trim() &&
      postalCode.trim() &&
      municipality.trim();

    if (!hasAddress) {
      setLat(null);
      setLon(null);
      setGeoStatus(null);
      return;
    }

    const timer = window.setTimeout(async () => {
      const req: GeocodeRequestDto = {
        street: street.trim(),
        houseNumber: houseNumber.trim(),
        postalCode: postalCode.trim(),
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
        setErrors((prev) => ({ ...prev, latlon: "Morada não localizada." }));
      } finally {
        if (aliveRef.current) setGeoLoading(false);
      }
    }, 900);

    return () => window.clearTimeout(timer);
  }, [open, addressKey, loading, street, houseNumber, postalCode, municipality, selectedDistrictName]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (loading) return;

        if (!hasDraft) {
          onClose();
          return;
        }

        const confirmed = window.confirm("Tens alterações por guardar. Desejas mesmo cancelar?");
        if (confirmed) onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, loading, hasDraft, onClose]);

  const formReady = useMemo(() => {
    const hasBasics =
      name.trim().length > 0 &&
      Boolean(districtId) &&
      municipality.trim().length > 0 &&
      street.trim().length > 0 &&
      houseNumber.trim().length > 0 &&
      postalCode.trim().length > 0;

    const hasGeo = lat != null && lon != null && !geoLoading;
    const hasImages = images.length > 0 && !imagesUploading;

    return hasBasics && hasGeo && hasImages && !loading;
  }, [
    name,
    districtId,
    municipality,
    street,
    houseNumber,
    postalCode,
    lat,
    lon,
    geoLoading,
    images,
    imagesUploading,
    loading,
  ]);

  const canGoBack = step > 1;

  const primaryLabel = loading
    ? "A criar…"
    : imagesUploading
      ? "A processar imagens…"
      : geoLoading && step === 2
        ? "A localizar…"
        : step === 3
          ? "Criar"
          : "Próximo passo";

  function goToNextStep() {
    const nextErrors = validateStep(step);
    markFieldsTouched(STEP_FIELDS[step]);
    setErrors((prev) => ({ ...prev, ...nextErrors }));

    if (Object.keys(nextErrors).length > 0) {
      showValidationToasts(nextErrors);
      return;
    }

    if (step < 3) {
      setStep((prev) => (prev + 1) as Step);
    }
  }

  function goToStep(targetStep: Step) {
    if (targetStep === step) return;

    if (targetStep < step) {
      setStep(targetStep);
      return;
    }

    let current = step;

    while (current < targetStep) {
      const nextErrors = validateStep(current);
      markFieldsTouched(STEP_FIELDS[current]);
      setErrors((prev) => ({ ...prev, ...nextErrors }));

      if (Object.keys(nextErrors).length > 0) {
        showValidationToasts(nextErrors);
        return;
      }

      current = (current + 1) as Step;
    }

    setStep(targetStep);
  }

  function handleCancel() {
    if (loading) return;

    if (!hasDraft) {
      onClose();
      return;
    }

    const confirmed = window.confirm("Tens alterações por guardar. Desejas mesmo cancelar?");
    if (confirmed) onClose();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (step < 3) {
      goToNextStep();
      return;
    }

    if (loading || !formReady) return;

    const nextErrors = validateForm();
    markFieldsTouched([...STEP_FIELDS[1], ...STEP_FIELDS[2], ...STEP_FIELDS[3]]);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      showValidationToasts(nextErrors);
      return;
    }

    if (lat == null || lon == null) {
      setErrors((prev) => ({ ...prev, latlon: "Morada não localizada." }));
      toast.error("Morada não localizada.");
      return;
    }

    if (imagesUploading) {
      toast.info("Ainda a processar imagens…");
      return;
    }

    setLoading(true);

    try {
      const imagesClean = images.map(stripNameHash);

      const created = await createPoi({
        name: name.trim(),
        category,
        description: description.trim() || null,
        districtId: Number(districtId),
        municipality: municipality.trim(),
        lat,
        lon,
        image: imagesClean[0],
        images: imagesClean,
      });

      toast.success("Negócio criado com sucesso.");
      onClose();
      window.dispatchEvent(new CustomEvent("pt:open-poi", { detail: { poiId: created.id } }));
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao criar negócio");
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }

  if (!open || !canCreate) return null;

  return ReactDOM.createPortal(
    <div
      className="create-poi-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          handleCancel();
        }
      }}
    >
      <div
        className="create-poi-card"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-poi-title"
      >
        <div className="create-poi-header">
          <h2 id="create-poi-title" className="create-poi-title">
            Criar Negócio
          </h2>

          <p className="create-poi-subtitle">{getStepSubtitle(step)}</p>

          <div className="create-poi-stepper" aria-label="Passos de criação">
            {[1, 2, 3].map((item) => {
              const stepNumber = item as Step;
              const state =
                step === stepNumber ? "is-active" : step > stepNumber ? "is-done" : "";

              return (
                <button
                  key={item}
                  type="button"
                  className={`create-poi-step ${state}`}
                  onClick={() => goToStep(stepNumber)}
                >
                  <div className="create-poi-step__bullet">{item}</div>
                  <div className="create-poi-step__meta">
                    <span className="create-poi-step__label">Passo {item}</span>
                    <strong className="create-poi-step__title">{getStepTitle(stepNumber)}</strong>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="create-poi-body">
          <form onSubmit={onSubmit} className="create-poi-form">
            <div className="create-poi-stage">
              {step === 1 && (
                <>
                  <div className="create-poi-label-row">
                    <label className="create-poi-label" htmlFor="create-poi-category">
                      Negócio
                    </label>
                  </div>

                  <div className="create-poi-top-grid">
                    <div className="create-poi-type-block">
                      <Select
                        id="create-poi-category"
                        value={category}
                        onChange={(e) => setCategory(e.target.value as Category)}
                        disabled={loading}
                      >
                        {CATEGORY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="create-poi-description-block">
                      <Textarea
                        placeholder="Descrição"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        disabled={loading}
                      />
                    </div>

                    <div className="create-poi-name-block">
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
                      />
                    </div>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div className="create-poi-label-row">
                    <label className="create-poi-label" htmlFor="create-poi-district">
                      Morada
                    </label>
                  </div>

                  <div className="create-poi-grid">
                    <Select
                      id="create-poi-district"
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
                      {districts.map((district) => (
                        <option key={district.id} value={district.id}>
                          {district.namePt ?? district.name}
                        </option>
                      ))}
                    </Select>

                    <Input
                      placeholder="Concelho"
                      value={municipality}
                      onBlur={() => setFieldTouched("municipality")}
                      onChange={(e) => {
                        setMunicipality(e.target.value);
                        clearFieldError("municipality");
                      }}
                      disabled={loading}
                      autoComplete="address-level2"
                      invalid={isInvalid("municipality")}
                    />

                    <Input
                      placeholder="Rua"
                      value={street}
                      onBlur={() => setFieldTouched("street")}
                      onChange={(e) => {
                        setStreet(e.target.value);
                        clearFieldError("street");
                      }}
                      disabled={loading}
                      autoComplete="street-address"
                      invalid={isInvalid("street")}
                    />

                    <Input
                      placeholder="Nº"
                      value={houseNumber}
                      onBlur={() => setFieldTouched("houseNumber")}
                      onChange={(e) => {
                        setHouseNumber(e.target.value);
                        clearFieldError("houseNumber");
                      }}
                      disabled={loading}
                      inputMode="numeric"
                      autoComplete="address-line2"
                      invalid={isInvalid("houseNumber")}
                    />
                  </div>

                  <div className="create-poi-grid create-poi-grid--postal">
                    <Input
                      placeholder="Código Postal"
                      value={postalCode}
                      onBlur={() => setFieldTouched("postalCode")}
                      onChange={(e) => {
                        setPostalCode(normalizePostalCode(e.target.value));
                        clearFieldError("postalCode");
                      }}
                      disabled={loading}
                      inputMode="numeric"
                      autoComplete="postal-code"
                      invalid={isInvalid("postalCode")}
                    />
                  </div>

                  {(geoStatus || isInvalid("latlon")) && (
                    <div
                      className={`create-poi-geo ${
                        isInvalid("latlon") ? "is-invalid-block is-invalid-text" : ""
                      }`}
                    >
                      {geoStatus ?? "Morada não localizada."}
                    </div>
                  )}
                </>
              )}

              {step === 3 && (
                <>
                  <div className="create-poi-label-row">
                    <label className="create-poi-label">Imagens</label>
                  </div>

                  <div className="create-poi-media-layout">
                    <div className={isInvalid("images") ? "is-invalid-block" : ""}>
                      <ImageDropField
                        label="Imagens do Negócio"
                        images={images}
                        onChange={(list) => {
                          const next = list.slice(0, 6);
                          setImages(next);
                          clearFieldError("images");
                          setFieldTouched("images");
                        }}
                        store="dataUrl"
                        mode="media"
                        maxItems={10}
                        onUploadingChange={setImagesUploading}
                      />
                    </div>

                    <div className="create-poi-preview-panel">
                      <div className="create-poi-preview-stage">
                        {selectedPreview ? (
                          <img
                            src={selectedPreview}
                            alt="Pré-visualização da imagem selecionada"
                            className="create-poi-preview-image"
                          />
                        ) : (
                          <div className="create-poi-preview-empty">
                            Seleciona uma imagem para pré-visualizar
                          </div>
                        )}
                      </div>

                      {images.length > 0 && (
                        <div className="create-poi-preview-strip" role="list" aria-label="Lista de imagens">
                          {images.map((image, index) => {
                            const active = image === selectedPreview;

                            return (
                              <button
                                key={`${image}-${index}`}
                                type="button"
                                className={`create-poi-preview-thumb ${active ? "is-active" : ""}`}
                                onClick={() => setSelectedPreview(image)}
                                title={`Imagem ${index + 1}`}
                              >
                                <img src={image} alt={`Imagem ${index + 1}`} />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="create-poi-actions">
              {canGoBack && (
                <Button
                  type="button"
                  variant="ghost"
                  pill
                  strong
                  onClick={() => setStep((prev) => (prev - 1) as Step)}
                  disabled={loading}
                >
                  Voltar
                </Button>
              )}

              <Button
                type="button"
                variant="ghost"
                pill
                strong
                onClick={handleCancel}
                disabled={loading}
              >
                Cancelar
              </Button>

              <Button
                type="submit"
                variant="primary"
                pill
                strong
                disabled={step === 3 ? !formReady && !loading : loading}
              >
                {primaryLabel}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}