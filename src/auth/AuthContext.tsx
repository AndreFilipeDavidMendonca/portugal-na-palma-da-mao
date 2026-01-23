import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchCurrentUser, type CurrentUserDto } from "@/lib/api";

type AuthContextType = {
    user: CurrentUserDto | null;
    setUser: (u: CurrentUserDto | null) => void;
    refreshUser: () => Promise<CurrentUserDto | null>;
    bootstrapped: boolean; // evita “piscar” UI enquanto carrega /api/me
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<CurrentUserDto | null>(null);
    const [bootstrapped, setBootstrapped] = useState(false);

    const refreshUser = async () => {
        const u = await fetchCurrentUser().catch(() => null);
        setUser(u);
        return u;
    };

    useEffect(() => {
        let alive = true;

        fetchCurrentUser()
            .then((u) => {
                if (!alive) return;
                setUser(u);
            })
            .catch(() => {
                if (!alive) return;
                setUser(null);
            })
            .finally(() => {
                if (!alive) return;
                setBootstrapped(true);
            });

        return () => {
            alive = false;
        };
    }, []);

    const value = useMemo(
        () => ({ user, setUser, refreshUser, bootstrapped }),
        [user, bootstrapped]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
    return ctx;
}