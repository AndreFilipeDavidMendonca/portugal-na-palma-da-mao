import type { Step } from "./types";
import { getStepTitle } from "./utils";

type Props = {
  step: Step;
  onGoToStep: (step: Step) => void;
};

export default function CreatePoiProgress({ step, onGoToStep }: Props) {
  const steps: Step[] = [1, 2, 3];

  return (
    <div className="create-poi-stepper" aria-label="Passos de criação">
      {steps.map((item) => {
        const state =
          step === item ? "is-active" : step > item ? "is-done" : "";

        return (
          <button
            key={item}
            type="button"
            className={`create-poi-step ${state}`}
            onClick={() => onGoToStep(item)}
          >
            <div className="create-poi-step__bullet">{item}</div>

            <div className="create-poi-step__meta">
              <strong className="create-poi-step__title">{getStepTitle(item)}</strong>
            </div>
          </button>
        );
      })}
    </div>
  );
}