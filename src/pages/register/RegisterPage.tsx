import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { register } from "@/lib/api";
import { useAuth } from "@/auth/AuthContext";
import logo from "@/assets/logo.png";
import "./RegisterPage.scss";

type RegisterRole = "USER" | "BUSINESS";

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
    const [error, setError] = useState<string | null>(null);

    function validate(): string | null {
        if (!email.trim()) return "Email é obrigatório.";
        if (!password) return "Password é obrigatória.";
        if (password.length < 6) return "Password deve ter pelo menos 6 caracteres.";
        if (password !== confirm) return "As passwords não coincidem.";

        if (age.trim()) {
            const n = Number(age);
            if (!Number.isFinite(n) || n < 0 || n > 120) return "Idade inválida.";
        }
        return null;
    }

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (loading) return;

        const msg = validate();
        if (msg) {
            setError(msg);
            return;
        }

        setError(null);
        setLoading(true);

        try {
            const newUser = await register({
                role, // ✅ novo campo
                firstName: firstName.trim() || null,
                lastName: lastName.trim() || null,
                age: age.trim() ? Number(age) : null,
                nationality: nationality.trim() || null,
                phone: phone.trim() || null,
                email: email.trim(),
                password,
            });

            // 🔥 atualiza AuthContext (sem refresh)
            setUser(newUser);

            navigate(from, { replace: true });
        } catch (e: any) {
            setError(e?.message ?? "Falha no registo");
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

                    {/* Role selector */}
                    <div className="register-role">
                        <div className="register-role-label">Tipo de conta</div>

                        <div className="register-role-toggle">
                            <button
                                type="button"
                                className={`register-role-btn ${role === "USER" ? "is-active" : ""}`}
                                onClick={() => setRole("USER")}
                                disabled={loading}
                            >
                                Particular
                            </button>

                            <button
                                type="button"
                                className={`register-role-btn ${role === "BUSINESS" ? "is-active" : ""}`}
                                onClick={() => setRole("BUSINESS")}
                                disabled={loading}
                            >
                                Comercial
                            </button>
                        </div>
                    </div>

                    <div className="register-grid">
                        <input
                            className="register-input"
                            placeholder="Primeiro nome"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            autoComplete="given-name"
                            disabled={loading}
                        />

                        <input
                            className="register-input"
                            placeholder="Último nome"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            autoComplete="family-name"
                            disabled={loading}
                        />

                        <input
                            className="register-input"
                            placeholder="Idade"
                            inputMode="numeric"
                            value={age}
                            onChange={(e) => setAge(e.target.value.replace(/[^\d]/g, ""))}
                            disabled={loading}
                        />

                        <input
                            className="register-input"
                            placeholder="Nacionalidade (ex: PT)"
                            value={nationality}
                            onChange={(e) => setNationality(e.target.value)}
                            disabled={loading}
                        />

                        <input
                            className="register-input"
                            placeholder="Telefone"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            autoComplete="tel"
                            disabled={loading}
                        />

                        <input
                            className="register-input"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete="email"
                            disabled={loading}
                        />
                    </div>

                    <input
                        className="register-input"
                        placeholder="Password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                        disabled={loading}
                    />

                    <input
                        className="register-input"
                        placeholder="Confirmar password"
                        type="password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        autoComplete="new-password"
                        disabled={loading}
                    />

                    {error && <div className="register-error">{error}</div>}

                    <div className="register-actions">
                        <button className="register-btn register-btn--primary" type="submit" disabled={loading}>
                            {loading ? "A criar…" : "Criar conta"}
                        </button>

                        <button
                            className="register-btn register-btn--ghost"
                            type="button"
                            onClick={() => navigate("/login", { state: { from }, replace: true })}
                            disabled={loading}
                        >
                            Já tenho conta
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}