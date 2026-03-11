import { forwardRef, type ButtonHTMLAttributes } from "react";

const base =
  "inline-flex items-center justify-center font-medium transition rounded-ds-lg border focus:outline-none focus:ring-2 focus:ring-slate-500/50 focus:ring-offset-0 focus:ring-offset-transparent disabled:pointer-events-none disabled:opacity-60";

const variants: Record<string, string> = {
  primary: "border-transparent bg-slate-100 text-slate-900 hover:bg-white",
  secondary: "border-slate-600 bg-transparent text-slate-200 hover:bg-slate-800 hover:border-slate-500",
  ghost: "border-transparent bg-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200",
  danger: "border-slate-600 bg-transparent text-slate-400 hover:bg-slate-800 hover:text-red-300"
};

const sizes: Record<string, string> = {
  sm: "px-3 py-1.5 text-ds-caption",
  md: "px-4 py-2 text-ds-body",
  lg: "px-5 py-2.5 text-ds-body-lg"
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  asChild?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className = "", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
