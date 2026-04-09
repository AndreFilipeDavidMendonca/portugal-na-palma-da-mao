import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import "./ActionDropdown.scss";

export type ActionDropdownItem = {
  key: string;
  label: string;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  hidden?: boolean;
};

type Props = {
  items: ActionDropdownItem[];
  align?: "left" | "right";
  ariaLabel?: string;
  title?: string;
  className?: string;
};

export default function ActionDropdown({
  items,
  align = "right",
  ariaLabel = "Mais ações",
  title = "Mais ações",
  className = "",
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const visibleItems = useMemo(
    () => items.filter((item) => !item.hidden),
    [items]
  );

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((prev) => !prev), []);

  useEffect(() => {
    if (!open || !wrapRef.current) return;

    const rect = wrapRef.current.getBoundingClientRect();
    const menuWidth = 180;
    const offsetY = 8;

    let left =
      align === "right"
        ? rect.right - menuWidth
        : rect.left;

    left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));

    setMenuPos({
      top: rect.bottom + offsetY,
      left,
    });
  }, [open, align]);

  useEffect(() => {
    if (!open) return;

    const handlePointerOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      const triggerContains = wrapRef.current?.contains(target);
      const menuContains = Boolean(
        target instanceof Element && target.closest(".action-dropdown__menu--portal")
      );

      if (!triggerContains && !menuContains) {
        close();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };

    const handleReflow = () => {
      close();
    };

    document.addEventListener("mousedown", handlePointerOutside);
    document.addEventListener("touchstart", handlePointerOutside, { passive: true });
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleReflow);
    window.addEventListener("scroll", handleReflow, true);

    return () => {
      document.removeEventListener("mousedown", handlePointerOutside);
      document.removeEventListener("touchstart", handlePointerOutside);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleReflow);
      window.removeEventListener("scroll", handleReflow, true);
    };
  }, [open, close]);

  const handleItemClick = useCallback(
    async (item: ActionDropdownItem) => {
      if (item.disabled) return;

      try {
        await item.onClick();
      } finally {
        close();
      }
    },
    [close]
  );

  if (visibleItems.length === 0) return null;

  return (
    <div
      ref={wrapRef}
      className={`action-dropdown action-dropdown--${align} ${className}`.trim()}
    >
      <button
        type="button"
        className={`action-dropdown__trigger ${open ? "is-open" : ""}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggle();
        }}
        aria-label={ariaLabel}
        title={title}
        aria-expanded={open}
      >
        ⋮
      </button>

      {open && menuPos
        ? ReactDOM.createPortal(
            <div
              className="action-dropdown__menu action-dropdown__menu--portal"
              role="menu"
              style={{
                position: "fixed",
                top: `${menuPos.top}px`,
                left: `${menuPos.left}px`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {visibleItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className="action-dropdown__item"
                  onClick={() => {
                    void handleItemClick(item);
                  }}
                  disabled={item.disabled}
                  role="menuitem"
                >
                  {item.label}
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}