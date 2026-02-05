import logo from "@/assets/logo.png";

type Props = {
    email: string | null;
    isOpen: boolean;
    onToggle: () => void;
};

function getEmailLabel(email: string) {
    return email.split("@")[0];
}

export default function UserMenuButton({ email, isOpen, onToggle }: Props) {
    const isLoggedOut = !email;

    return (
        <button
            type="button"
            className="user-menu__btn"
            onClick={onToggle}
            title={email ?? "Iniciar sessão"}
            aria-haspopup="menu"
            aria-expanded={isOpen}
        >
            {isLoggedOut ? (
                <span className="user-menu__login-text">Iniciar sessão</span>
            ) : (
                <span className="user-menu__login-text">
                    {getEmailLabel(email)}
                </span>
            )}

            <img src={logo} alt=".pt" />
        </button>
    );
}