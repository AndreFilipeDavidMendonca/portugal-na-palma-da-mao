import { useEffect, useMemo, useRef, useState } from "react";
import "./WelcomeGuide.scss";

type StepPosition = "center" | "map" | "top-right";

type Step = {
  id: string;
  message: string;
  position: StepPosition;
};

const STORAGE_KEY = "ptdot:welcome-guide-shown-v1";
const START_DELAY_MS = 800;

const STEPS: Step[] = [
  {
    id: "welcome",
    message: 'Bem-vindo à plataforma "PontoPT".',
    position: "center",
  },
  {
    id: "explore",
    message:
      "Seleciona um distrito ou faz uma pesquisa na barra superior para iniciares a tua aventura.",
    position: "map",
  },
  {
    id: "account",
    message:
      "Cria uma conta, guarda os teus favoritos, anuncia os teus negócios e partilha com os teus amigos e novos contactos!",
    position: "top-right",
  },
];

export default function WelcomeGuide() {
  const [started, setStarted] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  const dismissedRef = useRef(false);
  const startTimerRef = useRef<number | null>(null);

  const step = useMemo(() => STEPS[stepIndex] ?? null, [stepIndex]);

  function finishGuide() {
    dismissedRef.current = true;
    setVisible(false);

    try {
      window.localStorage.setItem(STORAGE_KEY, "true");
    } catch {}
  }

  function goToNextStep() {
    if (stepIndex >= STEPS.length - 1) {
      finishGuide();
      return;
    }

    setVisible(false);

    setTimeout(() => {
      setStepIndex((prev) => prev + 1);
      setVisible(true);
    }, 180);
  }

  function goToPrevStep() {
    if (stepIndex === 0) return;

    setVisible(false);

    setTimeout(() => {
      setStepIndex((prev) => prev - 1);
      setVisible(true);
    }, 180);
  }

  useEffect(() => {
    try {
      const alreadyShown = window.localStorage.getItem(STORAGE_KEY);
      if (alreadyShown) return;
    } catch {}

    startTimerRef.current = window.setTimeout(() => {
      if (dismissedRef.current) return;
      setStarted(true);
      setVisible(true);
    }, START_DELAY_MS);

    return () => {
      if (startTimerRef.current) {
        window.clearTimeout(startTimerRef.current);
      }
    };
  }, []);

  if (!started || !step) return null;

  return (
    <div className="welcome-guide" aria-live="polite" aria-atomic="true">
      <div
        className={[
          "welcome-guide__card",
          `welcome-guide__card--${step.position}`,
          visible ? "is-visible" : "is-hidden",
        ].join(" ")}
        role="status"
      >
        <button
          type="button"
          className="welcome-guide__close"
          onClick={finishGuide}
          aria-label="Fechar introdução"
          title="Fechar"
        >
          ×
        </button>

        <div className="welcome-guide__content">
          <div className="welcome-guide__title">
            {step.id === "welcome" ? "PontoPT" : "Dica"}
          </div>

          <div className="welcome-guide__message">{step.message}</div>

          <div className="welcome-guide__actions">
            <button
              type="button"
              className="welcome-guide__action welcome-guide__action--ghost"
              onClick={goToPrevStep}
              disabled={stepIndex === 0}
            >
              Voltar
            </button>

            <button
              type="button"
              className="welcome-guide__action welcome-guide__action--primary"
              onClick={goToNextStep}
            >
              {stepIndex === STEPS.length - 1 ? "Percebi" : "Seguinte"}
            </button>
          </div>
        </div>

        {step.position !== "center" && (
          <span
            className={`welcome-guide__pointer welcome-guide__pointer--${step.position}`}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
}