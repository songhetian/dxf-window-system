import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 disabled:pointer-events-none disabled:opacity-50 active:scale-95",
  {
    variants: {
      variant: {
        default: "bg-blue-600 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500 hover:scale-[1.02]",
        outline: "border border-white/10 bg-white/5 backdrop-blur-sm hover:bg-white/10 text-slate-300 hover:text-white",
        ghost: "hover:bg-white/5 text-slate-400 hover:text-white",
        glass: "bg-white/10 backdrop-blur-md border border-white/10 shadow-xl hover:bg-white/20 text-white",
      },
      size: {
        default: "h-10 px-6 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-2xl px-8 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export { Button, buttonVariants }

const Button = React.forwardRef<HTMLButtonElement, any>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  }
)
