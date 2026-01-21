import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  // Base styles
  "inline-flex items-center justify-center gap-2 font-bold rounded-xl transition-all duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-white border-4 border-primary-dark hover:bg-primary-hover hover:-translate-y-0.5 focus-visible:ring-primary",
        secondary:
          "bg-card text-white border-4 border-card-border hover:bg-card-border hover:-translate-y-0.5 focus-visible:ring-card-border",
        success:
          "bg-success text-white border-4 border-success-dark hover:bg-success-hover hover:-translate-y-0.5 focus-visible:ring-success",
        danger:
          "bg-danger text-white border-4 border-danger-dark hover:bg-danger-hover hover:-translate-y-0.5 focus-visible:ring-danger",
        warning:
          "bg-warning text-white border-4 border-warning-dark hover:bg-warning-hover hover:-translate-y-0.5 focus-visible:ring-warning",
        ghost:
          "bg-transparent text-white/60 hover:bg-white/10 hover:text-white border-0 focus-visible:ring-white/50",
        outline:
          "bg-transparent text-white border-2 border-white/30 hover:bg-white/10 hover:border-white/50 focus-visible:ring-white/50",
      },
      size: {
        sm: "px-3 py-1.5 text-sm",
        md: "px-4 py-2.5 text-base",
        lg: "px-6 py-3 text-lg",
        icon: "p-2.5",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);
