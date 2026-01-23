import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { login } from "@/lib/api";
import logo from "@/assets/logo.png";
import "./LoginPage.scss";

export default function Login() {
    const navigate = useNavigate();
    const location = useLocation();

    const from = useMemo(() => (location.state as any)?.from ?? "/", [location.state]);

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (loading) return;

        setError(null);
        setLoading(true);

        try {
            await login(email, password);
            navigate(from, { replace: true });
        } catch (e: any) {
            setError(e?.message ?? "Falha no login");
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
                        className="login-input"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        disabled={loading}
                    />

                    <input
                        className="login-input"
                        placeholder="Password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        disabled={loading}
                    />

                    {error && <div className="login-error">{error}</div>}

                    <div className="login-actions">
                        <button className="login-btn login-btn--primary" type="submit" disabled={loading}>
                            {loading ? "A entrar…" : "Entrar"}
                        </button>

                        <button
                            className="login-btn login-btn--ghost"
                            type="button"
                            onClick={() => navigate("/", { replace: true })}
                            disabled={loading}
                        >
                            Cancelar
                        </button>
                    </div>

                    {/* ✅ CTA para registo */}
                    <div className="login-footer">
                        <span className="login-footer__text">Ainda não tens conta?</span>
                        <button
                            type="button"
                            className="login-link"
                            disabled={loading}
                            onClick={() => navigate("/register", { state: { from }, replace: true })}
                        >
                            Criar conta
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}