// src/pages/auth/LoginPage.tsx
import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { login } from "@/lib/api";
import { useAuth } from "@/auth/AuthContext";
import logo from "@/assets/logo.png";
import { toast } from "@/components/Toastr/toast";
import "./LoginPage.scss";
import Button from "@/components/Button/Button";

type FieldKey = "email" | "password";
type FieldErrors = Partial<Record<FieldKey, string>>;

function getErrorMessage(e: any) {
    const raw =
        e?.message ||
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.statusText ||
        "";

    const status = e?.status ?? e?.response?.status;

    // “funcional”
    if (status === 401) return "Email ou password inválidos.";
    if (status === 403) return "Sem permissões para entrar.";
    if (status >= 500) return "Serviço indisponível. Tenta novamente em breve.";

    // fallback amigável
    if (typeof raw === "string" && raw.trim()) {
        // evita leak de “401 Unauthorized”
        if (/401|unauthorized/i.test(raw)) return "Email ou password inválidos.";
        return raw;
    }

    return "Falha no login.";
}

export default function LoginPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { setUser } = useAuth();

    const from = useMemo(() => (location.state as any)?.from ?? "/", [location.state]);

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<FieldErrors>({});
    const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});

    function touch(field: FieldKey) {
        setTouched((p) => ({ ...p, [field]: true }));
    }

    function clearFieldError(field: FieldKey) {
        setErrors((p) => {
            if (!p[field]) return p;
            const { [field]: _removed, ...rest } = p;
            return rest;
        });
    }

    function isInvalid(field: FieldKey) {
        return Boolean(touched[field] && errors[field]);
    }

    function validate(): FieldErrors {
        const next: FieldErrors = {};

        if (!email.trim()) next.email = "Email é obrigatório.";
        else if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = "Email inválido.";

        if (!password) next.password = "Password é obrigatória.";

        return next;
    }

    function showValidationToasts(nextErrors: FieldErrors) {
        for (const msg of Object.values(nextErrors)) {
            if (msg) toast.error(msg);
        }
    }

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (loading) return;

        setTouched({ email: true, password: true });

        const nextErrors = validate();
        setErrors(nextErrors);

        if (Object.keys(nextErrors).length > 0) {
            showValidationToasts(nextErrors);
            return;
        }

        setLoading(true);

        try {
            const u = await login(email.trim(), password);
            setUser(u);

            toast.success("Login efetuado.");
            navigate(from, { replace: true });
        } catch (err: any) {
            toast.error(getErrorMessage(err));

            // UX: se falhou auth, marca ambos como inválidos
            setErrors((p) => ({
                ...p,
                email: p.email ?? "Verifica o email.",
                password: p.password ?? "Verifica a password.",
            }));
            setTouched((t) => ({ ...t, email: true, password: true }));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-logo">
                    <img src={logo} alt=".pt" />
                </div>

                <h2 className="login-title">Login</h2>
                <p className="login-subtitle">Introduza os seus dados</p>

                <form onSubmit={onSubmit} className="login-form">
                    <input
                        className={`login-input ${isInvalid("email") ? "is-invalid" : ""}`}
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

                    <input
                        className={`login-input ${isInvalid("password") ? "is-invalid" : ""}`}
                        placeholder="Password"
                        type="password"
                        value={password}
                        onBlur={() => touch("password")}
                        onChange={(e) => {
                            setPassword(e.target.value);
                            clearFieldError("password");
                        }}
                        autoComplete="current-password"
                        disabled={loading}
                    />

                    <div className="login-actions">
                        <Button variant="primary" pill strong type="submit" disabled={loading}>
                            {loading ? "A entrar…" : "Entrar"}
                        </Button>

                        <Button
                            variant="ghost"
                            pill
                            strong
                            type="button"
                            onClick={() => navigate("/", { replace: true })}
                            disabled={loading}
                        >
                            Cancelar
                        </Button>
                    </div>

                    <div className="login-footer">
                        <span className="login-footer__text">Ainda não tens conta?</span>
                        <Button
                            type="button"
                            variant="ghost"
                            pill
                            size="xs"
                            strong
                            disabled={loading}
                            onClick={() => navigate("/register", { state: { from }, replace: true })}
                        >
                            Criar conta
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}