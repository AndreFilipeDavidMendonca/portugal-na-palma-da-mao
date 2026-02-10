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
import { getAuthToken } from "@/lib/authToken";

type AuthContextType = {
    user: CurrentUserDto | null;
    setUser: (u: CurrentUserDto | null) => void;
    refreshUser: () => Promise<CurrentUserDto | null>;
    bootstrapped: boolean; // evita “piscar”
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<CurrentUserDto | null>(null);
    const [bootstrapped, setBootstrapped] = useState(false);

    // evita chamadas concorrentes ao /me
    const inflightRef = useRef<Promise<CurrentUserDto | null> | null>(null);

    const refreshUser = useCallback(async () => {
        // se não há token, não faz sentido bater no /me
        const token = getAuthToken();
        if (!token) {
            setUser(null);
            return null;
        }

        if (inflightRef.current) return inflightRef.current;

        const p = fetchCurrentUser()
            .then((u) => {
                setUser(u);
                return u;
            })
            .catch(() => {
                // IMPORTANT: aqui NÃO apagues token automaticamente.
                // Enquanto o BE ainda está em migração, 401 no /me pode ser “normal”.
                setUser(null);
                return null;
            })
            .finally(() => {
                inflightRef.current = null;
            });

        inflightRef.current = p;
        return p;
    }, []);

    useEffect(() => {
        let alive = true;

        (async () => {
            try {
                const token = getAuthToken();
                if (!token) {
                    if (!alive) return;
                    setUser(null);
                    return;
                }

                const u = await fetchCurrentUser().catch(() => null);
                if (!alive) return;
                setUser(u);
            } finally {
                if (!alive) return;
                setBootstrapped(true);
            }
        })();

        return () => {
            alive = false;
        };
    }, []);

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