const KEY = "ptdot_auth_token";

let memToken: string | null = null;

export function getAuthToken(): string | null {
    if (memToken !== null) return memToken;

    try {
        const t = localStorage.getItem(KEY);
        memToken = t;
        return t;
    } catch {
        return null;
    }
}

export function setAuthToken(token: string | null) {
    memToken = token;

    try {
        if (!token) localStorage.removeItem(KEY);
        else localStorage.setItem(KEY, token);
    } catch {
        // ignore
    }
}

export function clearAuthToken() {
    setAuthToken(null);
}