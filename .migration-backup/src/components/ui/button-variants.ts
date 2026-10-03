import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 font-medium whitespace-nowrap transition-[background-color,color,opacity,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:not-disabled:scale-[0.96]",
  {
    variants: {
      variant: {
        default: "bg-blue text-paper hover:bg-blue-hover",
        inverted: "bg-paper text-ink hover:bg-paper/90",
        ghost: "bg-transparent text-blue hover:opacity-70",
        outline:
          "bg-transparent text-foreground shadow-[inset_0_0_0_1px_var(--color-border)] hover:bg-muted",
        dark: "bg-ink text-paper hover:bg-label",
      },
      size: {
        default: "min-h-11 rounded-full px-5 text-base",
        sm: "min-h-10 rounded-full px-4 text-sm",
        lg: "min-h-12 rounded-full px-6 text-base",
        icon: "size-11 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
