import { useMemo, useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { register } from "@/lib/api";
import { useAuth } from "@/auth/AuthContext";
import logo from "@/assets/logo.png";
import "./AuthModal.scss";
import { toast } from "@/components/Toastr/toast";
import Button from "@/components/Button/Button";
import Input from "@/components/Input/TextField/Input";

type Props = {
  open: boolean;
  onClose: () => void;
  onOpenLogin: () => void;
};

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

function emailTrim(v: string) {
  return v.trim().toLowerCase();
}

export default function RegisterModal({ open, onClose, onOpenLogin }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();

  const from = useMemo(() => (location.state as any)?.from ?? "/", [location.state]);

  const [role, setRole] = useState<RegisterRole>("USER");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [age, setAge] = useState("");
  const [nationality, setNationality] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

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
    if (!open) return;
    // Reset form on open
    setFirstName("");
    setLastName("");
    setAge("");
    setNationality("");
    setPhone("");
    setEmail("");
    setPassword("");
    setConfirm("");
    setErrors({});
    setTouched({});
    setLoading(false);
  }, [open]);

  const touch = (k: FieldKey) => setTouched((prev) => ({ ...prev, [k]: true }));

  const clearFieldError = (k: FieldKey) => {
    setErrors((prev) => {
      if (!prev[k]) return prev;
      const { [k]: _removed, ...rest } = prev;
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

    const emailValue = email.trim();
    if (!emailValue) next.email = "Email é obrigatório.";
    else if (!isEmailLike(emailValue)) next.email = "Email inválido.";

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
    setTouched((prev) => ({
      ...prev,
      ...Object.fromEntries(ALL_FIELDS.map((k) => [k, true])),
    }));
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

      if (!aliveRef.current) return;

      setUser(newUser);
      toast.success("Conta criada com sucesso.");
      onClose();
      navigate(from, { replace: true });
    } catch (err: any) {
      if (!aliveRef.current) return;
      toast.error(err?.message ?? "Falha no registo");
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }

  if (!open) return null;

  return ReactDOM.createPortal(
    <div className="auth-overlay" onClick={() => !loading && onClose()}>
      <div
        className="auth-card auth-card--register"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-register-title"
      >

        <h2 id="auth-register-title" className="auth-title">
          Criar Conta
        </h2>

        <p className="auth-subtitle">
          Crie a sua conta para explorar, guardar os seus locais favoritos e anunciar os seus negócios.
        </p>

        <form onSubmit={onSubmit} className="auth-form">
          <div className="auth-role">
            <div className="auth-role-label">Tipo de conta</div>

            <div className="auth-role-toggle">
              <Button
                type="button"
                className={`auth-role-btn ${role === "USER" ? "is-active" : ""}`}
                onClick={() => setRole("USER")}
                disabled={loading}
              >
                <span className="auth-role-btn__title">Particular</span>
                <span className="auth-role-btn__hint">Explorar, guardar, comentar</span>
              </Button>

              <Button
                type="button"
                className={`auth-role-btn ${role === "BUSINESS" ? "is-active" : ""}`}
                onClick={() => setRole("BUSINESS")}
                disabled={loading}
              >
                <span className="auth-role-btn__title">Empresarial</span>
                <span className="auth-role-btn__hint">Gerir e anunciar os seus negócios</span>
              </Button>
            </div>
          </div>

          <div className="auth-grid">
            <Input
              placeholder="Primeiro nome"
              value={firstName}
              invalid={isInvalid("firstName")}
              onBlur={() => touch("firstName")}
              onChange={(e) => {
                setFirstName(e.target.value);
                clearFieldError("firstName");
              }}
              disabled={loading}
              autoComplete="given-name"
            />

            <Input
              placeholder="Último nome"
              value={lastName}
              invalid={isInvalid("lastName")}
              onBlur={() => touch("lastName")}
              onChange={(e) => {
                setLastName(e.target.value);
                clearFieldError("lastName");
              }}
              disabled={loading}
              autoComplete="family-name"
            />

            <Input
              placeholder="Idade"
              value={age}
              invalid={isInvalid("age")}
              onBlur={() => touch("age")}
              onChange={(e) => {
                setAge(e.target.value.replace(/[^\d]/g, ""));
                clearFieldError("age");
              }}
              disabled={loading}
              inputMode="numeric"
            />

            <Input
              placeholder="Nacionalidade"
              value={nationality}
              invalid={isInvalid("nationality")}
              onBlur={() => touch("nationality")}
              onChange={(e) => {
                setNationality(e.target.value);
                clearFieldError("nationality");
              }}
              disabled={loading}
              autoComplete="country-name"
            />

            <Input
              placeholder="Telefone"
              value={phone}
              invalid={isInvalid("phone")}
              onBlur={() => touch("phone")}
              onChange={(e) => {
                setPhone(e.target.value);
                clearFieldError("phone");
              }}
              disabled={loading}
              type="tel"
              autoComplete="tel"
            />

            <Input
              placeholder="Email"
              value={email}
              invalid={isInvalid("email")}
              onBlur={() => touch("email")}
              onChange={(e) => {
                setEmail(e.target.value);
                clearFieldError("email");
              }}
              disabled={loading}
              type="email"
              autoComplete="email"
            />
          </div>

          <div className="auth-grid auth-grid--security">
            <Input
              type="password"
              placeholder="Password"
              value={password}
              invalid={isInvalid("password")}
              onBlur={() => touch("password")}
              onChange={(e) => {
                setPassword(e.target.value);
                clearFieldError("password");
                if (touched.confirm) clearFieldError("confirm");
              }}
              disabled={loading}
              autoComplete="new-password"
            />

            <Input
              type="password"
              placeholder="Confirmar password"
              value={confirm}
              invalid={isInvalid("confirm")}
              onBlur={() => touch("confirm")}
              onChange={(e) => {
                setConfirm(e.target.value);
                clearFieldError("confirm");
              }}
              disabled={loading}
              autoComplete="new-password"
            />
          </div>

          <div className="auth-actions">
            <Button variant="primary" pill strong type="submit" disabled={loading}>
              {loading ? "A criar…" : "Criar conta"}
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
            <span className="auth-footer__text">Já tenho conta</span>
            <Button
              type="button"
              variant="ghost"
              pill
              size="xs"
              strong
              disabled={loading}
              onClick={() => {
                onClose();
                onOpenLogin();
              }}
            >
              Entrar
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
