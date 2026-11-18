import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  ChevronRight,
  MousePointer2,
  Rocket,
  Wallet,
  X,
} from "lucide-react";

const steps = [
  {
    title: "Welcome to tap2stacks",
    description: "Drop coins on the price board and watch the market move.",
    icon: Rocket,
  },
  {
    title: "1. Connect & Login",
    description: "Connect your wallet, then sign a message to authenticate without gas fees.",
    icon: Wallet,
  },
  {
    title: "2. Deposit Tokens",
    description: "Deposit on-chain tokens to receive an in-app balance for play.",
    icon: ArrowDownToLine,
  },
  {
    title: "3. Drop Your Coins",
    description: "Coins stack on a cell, up to $100 per cell. If the price line passes through your cell during its 5 seconds, you win.",
    icon: MousePointer2,
  },
  {
    title: "4. Win & Withdraw!",
    description: "Bigger wins rain coins. Winnings are credited to your in-app balance, and you can withdraw back to on-chain tokens.",
    icon: ArrowUpFromLine,
  },
];

export const HowItWorksModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!localStorage.getItem("hasSeenTradingOnboarding")) setIsOpen(true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem("hasSeenTradingOnboarding", "true");
    setIsOpen(false);
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) setCurrentStep((previous) => previous + 1);
    else handleDismiss();
  };

  const step = steps[currentStep];
  const Icon = step.icon;
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-ink/50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative max-h-[calc(100dvh-24px)] w-full max-w-[calc(100vw-24px)] overflow-y-auto rounded-xl border-2 border-ink bg-paper text-ink shadow-xl lg:max-w-md"
          >
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Close how it works"
              className="absolute right-4 top-4 rounded-lg p-1 hover:bg-yellow"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="p-6 sm:p-8">
              <div className="mb-6 flex justify-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-xl border-2 border-ink bg-yellow">
                  <Icon className="h-10 w-10" />
                </div>
              </div>
              <div className="min-h-[120px] text-center">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <h2 className="mb-2 text-2xl font-bold">{step.title}</h2>
                    <p className="text-[15px] leading-relaxed text-ink/75">{step.description}</p>
                  </motion.div>
                </AnimatePresence>
              </div>
              <p className="mt-5 text-center text-xs leading-relaxed text-ink/70">
                Testnet game. Test USDC has no value. Not for US persons. 18+.
              </p>
              <div className="mt-6 flex items-center justify-between gap-3">
                <div className="flex space-x-1.5" aria-label={`Step ${currentStep + 1} of ${steps.length}`}>
                  {steps.map((item, index) => (
                    <div
                      key={item.title}
                      className={`h-1.5 rounded-full ${index === currentStep ? "w-6 bg-ink" : "w-1.5 bg-ink/20"}`}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  {currentStep < steps.length - 1 && (
                    <button type="button" onClick={handleDismiss} className="px-2 py-2 text-sm text-ink/70 hover:text-ink">
                      Skip
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={nextStep}
                    className="flex items-center justify-center gap-2 rounded-lg border-2 border-ink bg-highlight px-5 py-2.5 text-sm font-bold transition hover:brightness-95"
                  >
                    {currentStep === steps.length - 1 ? "Start Playing" : "Next"}
                    {currentStep === steps.length - 1 ? <Check className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
