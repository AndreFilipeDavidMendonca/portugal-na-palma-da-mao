import "./UserMenuHeader.scss";

function initialsFromEmail(email?: string | null) {
    const s = (email ?? "").trim();
    if (!s) return "?";
    const left = s.split("@")[0] ?? s;
    const parts = left.split(/[.\-_]+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return left.slice(0, 2).toUpperCase();
}

type Props = {
    email: string | null;
    role: string | null;
};

export default function UserMenuHeader({ email, role }: Props) {
    return (
        <div className="user-menu__header">
            <div className="user-menu__avatar">{initialsFromEmail(email)}</div>
            <div className="user-menu__meta">
                <div className="user-menu__email">{email ?? ""}</div>
                {role && <div className="user-menu__role">{role}</div>}
            </div>
        </div>
    );
}