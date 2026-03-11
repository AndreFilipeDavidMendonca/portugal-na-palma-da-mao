import { useCallback, useEffect, useState } from "react";

export function useCreatePoiModal() {
  const [showCreatePoiModal, setShowCreatePoiModal] = useState(false);

  const openCreatePoi = useCallback(() => {
    setShowCreatePoiModal(true);
  }, []);

  const closeCreatePoi = useCallback(() => {
    setShowCreatePoiModal(false);
  }, []);

  useEffect(() => {
    const handleOpenCreatePoi = () => {
      openCreatePoi();
    };

    window.addEventListener("pt:open-create-poi", handleOpenCreatePoi);

    return () => {
      window.removeEventListener("pt:open-create-poi", handleOpenCreatePoi);
    };
  }, [openCreatePoi]);

  return {
    showCreatePoiModal,
    openCreatePoi,
    closeCreatePoi,
  };
}