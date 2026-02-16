const KEY = "ptdot_auth_token";

let memToken: string | null | undefined = undefined; // 👈 undefined = "não carregado"

export function getAuthToken(): string | null {
    if (memToken !== undefined) return memToken;

    try {
        memToken = localStorage.getItem(KEY); // string | null
        return memToken;
    } catch {
        memToken = null;
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