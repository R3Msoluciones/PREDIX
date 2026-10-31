import { cn } from "@/lib/utils";

const variantClass: Record<string, string> = {
  primary: "px-btn-primary",
  secondary: "px-btn-secondary",
  danger: "px-btn-danger",
  ghost: "px-btn-ghost",
  pill: "px-btn-pill",
};

export function TacticalButton({
  variant = "secondary",
  active,
  className,
  style,
  ...props
}: React.ComponentProps<"button"> & {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "pill";
  active?: boolean;
}) {
  return (
    <button
      className={cn("px-btn", variantClass[variant], className)}
      data-active={active}
      style={active && variant === "pill" ? { ...style, color: style?.color, background: `color-mix(in srgb, ${style?.color || "var(--px-brand)"} 18%, transparent)` } : style}
      {...props}
    />
  );
}
