import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Alturas seguem o alvo de toque de 44px do WCAG 2.2 (2.5.8). O tamanho
 * anterior era 32px — confortável no mouse, impreciso no polegar, e este é um
 * app que se usa de pé segurando o celular com uma mão.
 */
const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg",
    "text-sm font-medium whitespace-nowrap",
    "border border-transparent transition-colors outline-none select-none",
    "disabled:pointer-events-none disabled:opacity-45",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80",
        outline: "border-input bg-card hover:bg-muted active:bg-muted",
        secondary: "bg-secondary text-secondary-foreground hover:bg-muted active:bg-muted",
        ghost: "hover:bg-muted active:bg-muted",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80",
        "destructive-ghost": "text-destructive hover:bg-tint-danger active:bg-tint-danger",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4",
        sm: "h-9 rounded-md px-3 text-[0.8125rem]",
        lg: "h-12 rounded-lg px-5 text-base",
        icon: "size-11",
        "icon-sm": "size-9 rounded-md",
        inline: "h-auto p-0",
      },
      block: {
        true: "w-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  block,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, block, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
