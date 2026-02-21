import logo from "@/assets/logo.png";
import Button from "@/components/Button/Button";

type Props = {
    email: string | null;
    isOpen: boolean;
    onToggle: () => void;
};

function emailPrefix(email: string) {
    const at = email.indexOf("@");
    return at > 0 ? email.slice(0, at) : email;
}

export default function UserMenuButton({ email, isOpen, onToggle }: Props) {
    const isLoggedOut = !email;
    const label = isLoggedOut ? "Iniciar sessão" : emailPrefix(email);

    return (
        <Button
            type="button"
            className="user-menu__btn"
            onClick={onToggle}
            title={isLoggedOut ? "Iniciar sessão" : email ?? "Conta"}
            aria-haspopup="menu"
            aria-expanded={isOpen}
        >
            {/* Desktop: texto + logo */}
            <span className="user-menu__label">{label}</span>
            <img className="user-menu__logo" src={logo} alt=".pt" />

            {/* Mobile: hamburguer */}
            <span className="user-menu__hamburger" aria-hidden="true">
        ☰
      </span>
        </Button>
    );
}