import logo from "@/assets/logo.png";

type Props = {
    email: string | null;
    isOpen: boolean;
    onToggle: () => void;
};

export default function UserMenuButton({ email, isOpen, onToggle }: Props) {
    return (
        <button
            type="button"
            className="user-menu__btn"
            onClick={onToggle}
            title={email ?? "Conta"}
            aria-haspopup="menu"
            aria-expanded={isOpen}
        >
            <img src={logo} alt=".pt" />
        </button>
    );
}