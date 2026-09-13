import type { ButtonHTMLAttributes, Ref } from "react";
import { cx } from "@/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

interface IButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-accent-strong text-paper-raised shadow-[inset_0_-1px_0_oklch(0%_0_0/0.18)] hover:bg-accent-deep active:translate-y-px",
  secondary: "border border-rule-strong bg-paper-raised text-ink hover:border-ink active:translate-y-px",
  ghost: "text-ink-muted hover:text-ink hover:bg-paper-sunk",
  danger: "border border-failed/40 text-failed hover:bg-failed hover:text-paper-raised active:translate-y-px",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  className,
  disabled,
  children,
  type = "button",
  ...rest
}: IButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-sm font-medium whitespace-nowrap",
        "transition-[background-color,border-color,color,transform] duration-150",
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {isLoading && <span aria-hidden className="size-1.5 animate-breathe rounded-full bg-current" />}
      {children}
    </button>
  );
}
