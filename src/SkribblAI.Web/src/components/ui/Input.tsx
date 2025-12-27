import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, leftIcon, rightIcon, id, ...props }, ref) => {
    const generatedId = useId();
    const errorId = useId();
    const inputId = id || generatedId;
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-bold text-white/90 ml-1"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none"
              aria-hidden="true"
            >
              {leftIcon}
            </div>
          )}
          <input
            className={cn(
              "flex h-12 w-full rounded-xl border-2 border-card-border bg-background px-4 py-2 text-white ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:border-accent disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200",
              leftIcon && "pl-10",
              rightIcon && "pr-10",
              error &&
                "border-danger focus-visible:ring-danger focus-visible:border-danger",
              className
            )}
            ref={ref}
            id={inputId}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={error ? errorId : undefined}
            {...props}
          />
          {rightIcon && (
            <div
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none"
              aria-hidden="true"
            >
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p
            id={errorId}
            className="text-xs text-danger font-medium ml-1 animate-in slide-in-from-top-1 fade-in-0"
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
