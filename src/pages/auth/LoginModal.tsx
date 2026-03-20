import { useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { login } from "@/lib/api";
import { useAuth } from "@/auth/AuthContext";
import { toast } from "@/components/Toastr/toast";
import "./AuthModal.scss";
import Button from "@/components/Button/Button";
import Input from "@/components/Input/TextField/Input";

type Props = {
  open: boolean;
  onClose: () => void;
  onOpenRegister: () => void;
};

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

  if (status === 401) return "Email ou password inválidos.";
  if (status === 403) return "Sem permissões para entrar.";
  if (status >= 500) return "Serviço indisponível. Tenta novamente em breve.";

  if (typeof raw === "string" && raw.trim()) {
    if (/401|unauthorized/i.test(raw)) return "Email ou password inválidos.";
    return raw;
  }

  return "Falha no login.";
}

export default function LoginModal({ open, onClose, onOpenRegister }: Props) {
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
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  function clearFieldError(field: FieldKey) {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const { [field]: _removed, ...rest } = prev;
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
      const loggedUser = await login(email.trim(), password);
      setUser(loggedUser);

      toast.success("Login efetuado.");
      onClose();
      navigate(from, { replace: true });
    } catch (err: any) {
      toast.error(getErrorMessage(err));
      setErrors((prev) => ({
        ...prev,
        email: prev.email ?? "Verifica o email.",
        password: prev.password ?? "Verifica a password.",
      }));
      setTouched((prev) => ({ ...prev, email: true, password: true }));
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return ReactDOM.createPortal(
    <div className="auth-overlay" onClick={() => !loading && onClose()}>
      <div
        className="auth-card auth-card--login"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-login-title"
      >
        <h2 id="auth-login-title" className="auth-title">
          Login
        </h2>

        <p className="auth-subtitle">Introduza os seus dados</p>

        <form onSubmit={onSubmit} className="auth-form">
          <Input
            placeholder="Email"
            value={email}
            invalid={isInvalid("email")}
            onBlur={() => touch("email")}
            onChange={(e) => {
              setEmail(e.target.value);
              clearFieldError("email");
            }}
            autoComplete="email"
            disabled={loading}
          />

          <Input
            placeholder="Password"
            type="password"
            value={password}
            invalid={isInvalid("password")}
            onBlur={() => touch("password")}
            onChange={(e) => {
              setPassword(e.target.value);
              clearFieldError("password");
            }}
            autoComplete="current-password"
            disabled={loading}
          />

          <div className="auth-actions">
            <Button variant="primary" pill strong type="submit" disabled={loading}>
              {loading ? "A entrar…" : "Entrar"}
            </Button>

            <Button
              variant="ghost"
              pill
              strong
              type="button"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </Button>
          </div>

          <div className="auth-footer">
            <span className="auth-footer__text">Ainda não tens conta?</span>
            <Button
              type="button"
              variant="ghost"
              pill
              size="xs"
              strong
              disabled={loading}
              onClick={() => {
                onClose();
                onOpenRegister();
              }}
            >
              Criar conta
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}