"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Button, Textarea } from "@/components/ui";
import { ArrowLeft, ArrowRight, Check, Sparkles, X } from "lucide-react";
import {
  GUIDED_QUESTIONS,
  compileGuidedPrompt,
  type GuidedQuestion,
  type GuidedOption,
} from "@/lib/guidedModeQuestions";

interface GuidedModeWizardProps {
  projectType: "standard" | "pro";
  onComplete: (enrichedPrompt: string) => void;
  onSkip: () => void;
}

function ProgressDots({
  total,
  current,
}: {
  total: number;
  current: number;
}) {
  return (
    <div className="flex items-center justify-center gap-1.5" aria-label={`Step ${current + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-[var(--transition-normal)] ${
            i === current
              ? "w-6 bg-[var(--button-primary-bg)]"
              : i < current
                ? "w-1.5 bg-[var(--button-primary-bg)]/50"
                : "w-1.5 bg-[var(--border-subtle)]"
          }`}
        />
      ))}
    </div>
  );
}

function OptionPill({
  option,
  selected,
  onSelect,
  multiSelect,
}: {
  option: GuidedOption;
  selected: boolean;
  onSelect: () => void;
  multiSelect?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-[var(--radius-md)] border-2 px-4 py-3 text-left transition-all duration-[var(--transition-fast)] ${
        selected
          ? "border-[var(--button-primary-bg)] bg-[var(--button-primary-bg)]/10"
          : "border-[var(--border-default)] bg-[var(--background-secondary)] hover:border-[var(--border-subtle)] hover:bg-[var(--background-tertiary)]"
      }`}
    >
      <span className="flex items-center gap-2">
        {multiSelect && (
          <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
            selected
              ? "border-[var(--button-primary-bg)] bg-[var(--button-primary-bg)]"
              : "border-[var(--border-subtle)] bg-transparent"
          }`}>
            {selected && <Check className="h-3 w-3 text-white" aria-hidden />}
          </span>
        )}
        <span>
          <span className="block text-sm font-medium text-[var(--text-primary)]">
            {option.label}
          </span>
          {option.description && (
            <span className="mt-0.5 block text-xs text-[var(--text-tertiary)]">
              {option.description}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

export function GuidedModeWizard({
  projectType,
  onComplete,
  onSkip,
}: GuidedModeWizardProps) {
  const questions = GUIDED_QUESTIONS.filter(
    (q) => !q.projectTypeFilter || q.projectTypeFilter === projectType
  );

  const totalSteps = questions.length + 1;
  const [step, setStep] = useState(0);
  const [appDescription, setAppDescription] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (step === 0) {
      textareaRef.current?.focus();
    }
  }, [step]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const h = Math.min(el.scrollHeight, 120);
    el.style.height = `${h}px`;
  }, [appDescription]);

  const handleSelect = useCallback(
    (questionId: string, value: string, multiSelect?: boolean) => {
      if (!multiSelect) {
        setAnswers((prev) => ({ ...prev, [questionId]: value }));
        return;
      }
      setAnswers((prev) => {
        const current = (prev[questionId] ?? "").split(",").filter(Boolean);
        if (value === "none") {
          return { ...prev, [questionId]: "none" };
        }
        const withoutNone = current.filter((v) => v !== "none");
        const next = withoutNone.includes(value)
          ? withoutNone.filter((v) => v !== value)
          : [...withoutNone, value];
        return { ...prev, [questionId]: next.join(",") || "" };
      });
    },
    []
  );

  const handleNext = useCallback(() => {
    if (step < totalSteps - 1) {
      setStep((s) => s + 1);
    }
  }, [step, totalSteps]);

  const handleBack = useCallback(() => {
    if (step > 0) {
      setStep((s) => s - 1);
    }
  }, [step]);

  const handleBuild = useCallback(() => {
    const prompt = compileGuidedPrompt(appDescription, answers, projectType);
    onComplete(prompt);
  }, [appDescription, answers, projectType, onComplete]);

  const canProceedFromDescription = appDescription.trim().length > 0;
  const currentQuestion: GuidedQuestion | undefined = step > 0 ? questions[step - 1] : undefined;
  const isLastQuestion = step === totalSteps - 1;

  const canProceed =
    step === 0
      ? canProceedFromDescription
      : currentQuestion
        ? !!answers[currentQuestion.id]
        : true;

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-5 animate-fade-in">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[var(--button-primary-bg)]" aria-hidden />
            <h2 className="text-lg font-semibold text-[var(--text-primary)] tracking-tight">
              Guided Mode
            </h2>
          </div>
          <button
            type="button"
            onClick={onSkip}
            className="flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
            aria-label="Skip guided mode"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Skip
          </button>
        </div>

        {/* Progress */}
        <ProgressDots total={totalSteps} current={step} />

        {/* Step 0: App description */}
        {step === 0 && (
          <div className="space-y-3 animate-fade-in">
            <div>
              <h3 className="text-base font-medium text-[var(--text-primary)]">
                Describe your app idea
              </h3>
              <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                What do you want to build? Be as specific as you like.
              </p>
            </div>
            <Textarea
              ref={textareaRef}
              value={appDescription}
              onChange={(e) => setAppDescription(e.target.value)}
              placeholder="e.g. A fitness tracker with activity rings and weekly stats"
              className="!min-h-[80px] max-h-[120px] resize-none"
              rows={3}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && canProceedFromDescription) {
                  e.preventDefault();
                  handleNext();
                }
              }}
            />
          </div>
        )}

        {/* Question steps */}
        {step > 0 && currentQuestion && (
          <div className="space-y-3 animate-fade-in" key={currentQuestion.id}>
            <div>
              <h3 className="text-base font-medium text-[var(--text-primary)]">
                {currentQuestion.title}
              </h3>
              <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                {currentQuestion.subtitle}
              </p>
            </div>
            <div className="space-y-2">
              {currentQuestion.options.map((option) => {
                const isMulti = currentQuestion.multiSelect;
                const currentVal = answers[currentQuestion.id] ?? "";
                const isSelected = isMulti
                  ? currentVal.split(",").includes(option.value)
                  : currentVal === option.value;
                return (
                  <OptionPill
                    key={option.value}
                    option={option}
                    selected={isSelected}
                    multiSelect={isMulti}
                    onSelect={() => handleSelect(currentQuestion.id, option.value, isMulti)}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={step === 0}
            className="!px-3 !py-2 !min-h-[36px] text-sm"
          >
            <ArrowLeft className="h-4 w-4 mr-1" aria-hidden />
            Back
          </Button>

          {isLastQuestion && canProceed ? (
            <Button
              variant="primary"
              onClick={handleBuild}
              className="!px-5 !py-2 !min-h-[36px] text-sm"
            >
              Build
              <ArrowRight className="h-4 w-4 ml-1" aria-hidden />
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={handleNext}
              disabled={!canProceed}
              className="!px-5 !py-2 !min-h-[36px] text-sm"
            >
              Next
              <ArrowRight className="h-4 w-4 ml-1" aria-hidden />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
