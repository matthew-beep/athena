import { forwardRef } from "react";
import { cn } from "../../utils/cn";

interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={id}
            className="text-sm text-muted-foreground font-medium"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            "glass-subtle rounded-xl px-4 py-2.5 text-sm",
            "text-foreground placeholder:text-muted-foreground",
            "outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30",
            "transition-all duration-150",
            error && "border-destructive/50 focus:ring-destructive/30",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }
);
GlassInput.displayName = "GlassInput";
