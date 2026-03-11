import { useCallback, useEffect, useState } from "react";

export function useAuthModals() {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  const openLogin = useCallback(() => {
    setShowRegisterModal(false);
    setShowLoginModal(true);
  }, []);

  const openRegister = useCallback(() => {
    setShowLoginModal(false);
    setShowRegisterModal(true);
  }, []);

  const closeLogin = useCallback(() => {
    setShowLoginModal(false);
  }, []);

  const closeRegister = useCallback(() => {
    setShowRegisterModal(false);
  }, []);

  const closeAllAuth = useCallback(() => {
    setShowLoginModal(false);
    setShowRegisterModal(false);
  }, []);

  useEffect(() => {
    const handleOpenLogin = () => openLogin();
    const handleOpenRegister = () => openRegister();

    window.addEventListener("pt:open-login", handleOpenLogin);
    window.addEventListener("pt:open-register", handleOpenRegister);

    return () => {
      window.removeEventListener("pt:open-login", handleOpenLogin);
      window.removeEventListener("pt:open-register", handleOpenRegister);
    };
  }, [openLogin, openRegister]);

  return {
    showLoginModal,
    showRegisterModal,
    openLogin,
    openRegister,
    closeLogin,
    closeRegister,
    closeAllAuth,
  };
}