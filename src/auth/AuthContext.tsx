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
    bootstrapped: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<CurrentUserDto | null>(null);
    const [bootstrapped, setBootstrapped] = useState(false);

    const inflightRef = useRef<Promise<CurrentUserDto | null> | null>(null);

    const refreshUser = useCallback(async () => {
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
                await refreshUser();
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