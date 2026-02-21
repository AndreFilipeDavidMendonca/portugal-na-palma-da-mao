import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { register } from "@/lib/api";
import { useAuth } from "@/auth/AuthContext";
import logo from "@/assets/logo.png";
import "./RegisterPage.scss";
import { toast } from "@/components/Toastr/toast";
import Button from "@/components/Button/Button";

type RegisterRole = "USER" | "BUSINESS";

type FieldKey =
    | "firstName"
    | "lastName"
    | "age"
    | "nationality"
    | "phone"
    | "email"
    | "password"
    | "confirm";

type FieldErrors = Partial<Record<FieldKey, string>>;

const ALL_FIELDS: FieldKey[] = [
    "firstName",
    "lastName",
    "age",
    "nationality",
    "phone",
    "email",
    "password",
    "confirm",
];

function isEmailLike(v: string) {
    const s = v.trim();
    return s.includes("@") && s.includes(".") && s.length >= 5;
}

export default function RegisterPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { setUser } = useAuth();

    const from = useMemo(() => (location.state as any)?.from ?? "/", [location.state]);

    const [role, setRole] = useState<RegisterRole>("USER");

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [age, setAge] = useState<string>("");
    const [nationality, setNationality] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");

    const [loading, setLoading] = useState(false);

    const [errors, setErrors] = useState<FieldErrors>({});
    const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});

    const touch = (k: FieldKey) => setTouched((p) => ({ ...p, [k]: true }));

    const clearFieldError = (k: FieldKey) => {
        setErrors((p) => {
            if (!p[k]) return p;
            const { [k]: _removed, ...rest } = p;
            return rest;
        });
    };

    const isInvalid = (k: FieldKey) => Boolean(touched[k] && errors[k]);

    const validateForm = (): FieldErrors => {
        const next: FieldErrors = {};

        if (!firstName.trim()) next.firstName = "Primeiro nome é obrigatório.";
        if (!lastName.trim()) next.lastName = "Último nome é obrigatório.";

        const ageTrim = age.trim();
        if (!ageTrim) next.age = "Idade é obrigatória.";
        else {
            const n = Number(ageTrim);
            if (!Number.isFinite(n) || n < 0 || n > 120) next.age = "Idade inválida.";
        }

        if (!nationality.trim()) next.nationality = "Nacionalidade é obrigatória.";

        const phoneTrim = phone.trim();
        if (!phoneTrim) next.phone = "Telefone é obrigatório.";
        else if (phoneTrim.replace(/\D/g, "").length < 6) next.phone = "Telefone inválido.";

        const emailTrim = email.trim();
        if (!emailTrim) next.email = "Email é obrigatório.";
        else if (!isEmailLike(emailTrim)) next.email = "Email inválido.";

        if (!password) next.password = "Password é obrigatória.";
        else if (password.length < 6) next.password = "Password deve ter pelo menos 6 caracteres.";

        if (!confirm) next.confirm = "Confirmar password é obrigatório.";
        else if (password !== confirm) next.confirm = "As passwords não coincidem.";

        return next;
    };

    const showValidationToasts = (nextErrors: FieldErrors) => {
        for (const msg of Object.values(nextErrors)) {
            if (msg) toast.error(msg);
        }
    };

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (loading) return;

        const nextErrors = validateForm();
        setTouched((t) => ({ ...t, ...Object.fromEntries(ALL_FIELDS.map((k) => [k, true])) }));
        setErrors(nextErrors);

        if (Object.keys(nextErrors).length > 0) {
            showValidationToasts(nextErrors);
            return;
        }

        setLoading(true);

        try {
            const newUser = await register({
                role,
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                age: Number(age.trim()),
                nationality: nationality.trim(),
                phone: phone.trim(),
                email: emailTrim(email),
                password,
            });

            setUser(newUser);
            toast.success("Conta criada com sucesso.");
            navigate(from, { replace: true });
        } catch (err: any) {
            toast.error(err?.message ?? "Falha no registo");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="register-page">
            <div className="register-card">
                <div className="register-logo">
                    <img src={logo} alt=".pt" />
                </div>

                <h2 className="register-title">Criar conta</h2>

                <form onSubmit={onSubmit} className="register-form">
                    <div className="register-role">
                        <div className="register-role-label">Tipo de conta</div>

                        <div className="register-role-toggle">
                            <Button
                                type="button"
                                className={`register-role-btn ${role === "USER" ? "is-active" : ""}`}
                                onClick={() => setRole("USER")}
                                disabled={loading}
                            >
                                Particular
                            </Button>

                            <Button
                                type="button"
                                className={`register-role-btn ${role === "BUSINESS" ? "is-active" : ""}`}
                                onClick={() => setRole("BUSINESS")}
                                disabled={loading}
                            >
                                Empresarial
                            </Button>
                        </div>
                    </div>

                    <div className="register-grid">
                        <input
                            className={`register-input ${isInvalid("firstName") ? "is-invalid" : ""}`}
                            placeholder="Primeiro nome"
                            value={firstName}
                            onBlur={() => touch("firstName")}
                            onChange={(e) => {
                                setFirstName(e.target.value);
                                clearFieldError("firstName");
                            }}
                            autoComplete="given-name"
                            disabled={loading}
                        />

                        <input
                            className={`register-input ${isInvalid("lastName") ? "is-invalid" : ""}`}
                            placeholder="Último nome"
                            value={lastName}
                            onBlur={() => touch("lastName")}
                            onChange={(e) => {
                                setLastName(e.target.value);
                                clearFieldError("lastName");
                            }}
                            autoComplete="family-name"
                            disabled={loading}
                        />

                        <input
                            className={`register-input ${isInvalid("age") ? "is-invalid" : ""}`}
                            placeholder="Idade"
                            inputMode="numeric"
                            value={age}
                            onBlur={() => touch("age")}
                            onChange={(e) => {
                                setAge(e.target.value.replace(/[^\d]/g, ""));
                                clearFieldError("age");
                            }}
                            disabled={loading}
                        />

                        <input
                            className={`register-input ${isInvalid("nationality") ? "is-invalid" : ""}`}
                            placeholder="Nacionalidade (ex: PT)"
                            value={nationality}
                            onBlur={() => touch("nationality")}
                            onChange={(e) => {
                                setNationality(e.target.value);
                                clearFieldError("nationality");
                            }}
                            disabled={loading}
                        />

                        <input
                            className={`register-input ${isInvalid("phone") ? "is-invalid" : ""}`}
                            placeholder="Telefone"
                            value={phone}
                            onBlur={() => touch("phone")}
                            onChange={(e) => {
                                setPhone(e.target.value);
                                clearFieldError("phone");
                            }}
                            autoComplete="tel"
                            disabled={loading}
                        />

                        <input
                            className={`register-input ${isInvalid("email") ? "is-invalid" : ""}`}
                            placeholder="Email"
                            value={email}
                            onBlur={() => touch("email")}
                            onChange={(e) => {
                                setEmail(e.target.value);
                                clearFieldError("email");
                            }}
                            autoComplete="email"
                            disabled={loading}
                        />
                    </div>

                    <input
                        className={`register-input ${isInvalid("password") ? "is-invalid" : ""}`}
                        placeholder="Password"
                        type="password"
                        value={password}
                        onBlur={() => touch("password")}
                        onChange={(e) => {
                            setPassword(e.target.value);
                            clearFieldError("password");
                            if (touched.confirm) clearFieldError("confirm");
                        }}
                        autoComplete="new-password"
                        disabled={loading}
                    />

                    <input
                        className={`register-input ${isInvalid("confirm") ? "is-invalid" : ""}`}
                        placeholder="Confirmar password"
                        type="password"
                        value={confirm}
                        onBlur={() => touch("confirm")}
                        onChange={(e) => {
                            setConfirm(e.target.value);
                            clearFieldError("confirm");
                        }}
                        autoComplete="new-password"
                        disabled={loading}
                    />

                    <div className="register-actions">
                        <Button variant="primary" pill strong type="submit" disabled={loading}>
                            {loading ? "A criar…" : "Criar conta"}
                        </Button>

                        <Button
                            variant="ghost"
                            pill
                            strong
                            type="button"
                            onClick={() => navigate("/login", { state: { from }, replace: true })}
                            disabled={loading}
                        >
                            Já tenho conta
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function emailTrim(v: string) {
    return v.trim().toLowerCase();
}