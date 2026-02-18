import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";

import { fetchCurrentUser, type CurrentUserDto } from "@/lib/api";
import { clearAuthToken, getAuthToken } from "@/lib/authToken";

type AuthContextType = {
    user: CurrentUserDto | null;
    setUser: (u: CurrentUserDto | null) => void;
    refreshUser: () => Promise<CurrentUserDto | null>;
    bootstrapped: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<CurrentUserDto | null>(null);
    const [bootstrapped, setBootstrapped] = useState(false);

    const inflightRef = useRef<Promise<CurrentUserDto | null> | null>(null);

    const refreshUser = useCallback(async () => {
        const token = getAuthToken();

        // Sem token: não há sessão
        if (!token) {
            setUser(null);
            return null;
        }

        if (inflightRef.current) return inflightRef.current;

        const p = (async () => {
            try {
                const u = await fetchCurrentUser();
                // fetchCurrentUser devolve null se 204 ou 401
                if (u) setUser(u);
                return u;
            } catch (e: any) {
                // Erro “normal” (rede/cold start/etc): não destruir sessão local
                // Mantém user como está; no refresh inicial user é null e ok, mas não “limpa token”.
                return null;
            } finally {
                inflightRef.current = null;
            }
        })();

        inflightRef.current = p;
        return p;
    }, []);

    useEffect(() => {
        let alive = true;

        (async () => {
            try {
                const u = await refreshUser();

                // Se havia token mas /api/me voltou null, é provável 401/204.
                // 204 seria estranho aqui; normalmente é 401. Para ser mais seguro:
                // - não limpamos token aqui, porque o backend pode estar a falhar temporariamente.
                // A limpeza de token por 401 fica tratada no apiFetch (ver api.ts abaixo).
                void u;
            } finally {
                if (alive) setBootstrapped(true);
            }
        })();

        return () => {
            alive = false;
        };
    }, [refreshUser]);

    const value = useMemo(
        () => ({ user, setUser, refreshUser, bootstrapped }),
        [user, refreshUser, bootstrapped]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
    return ctx;
}