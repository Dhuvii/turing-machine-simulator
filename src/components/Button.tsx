"use client";
import { cn } from "@/utils/cn";
import { VariantProps, cva } from "class-variance-authority";
import {
  AnimationDefinition,
  motion,
  useAnimationControls,
} from "framer-motion";
import { forwardRef } from "react";
import { Button as Btn, ButtonProps } from "react-aria-components";

const variants = {
  variant: {
    primary: "btn-primary",
    secondary: "btn-secondary",
    unstyled: "btn-unstyled",
    ghost: "btn-ghost p-0 md:p-0",
  },
};

const defaultStyles =
  "disable-highlight touch-none disabled:cursor-not-allowed select-none overflow-hidden rounded-xl bg-skin-btn-bg px-7 py-4 text-sm font-medium text-skin-btn-text outline-none ring-skin-btn-ring ring-offset-2 ring-offset-skin-primary hover:bg-skin-btn-bg-hover focus:outline-none disabled:bg-skin-btn-disabled data-[pressed]:bg-skin-btn-active data-[focus-visible]:ring-2 md:px-5 md:py-2.5";

export const ButtonVariants = cva(defaultStyles, {
  variants,
  defaultVariants: {
    variant: "primary",
  },
});

interface IButton extends ButtonProps, VariantProps<typeof ButtonVariants> {
  children: React.ReactNode;
  onClick?: () => void;
  isSpinning?: boolean;
  disabled?: boolean;
  wrapperClass?: string;
}

const Button = forwardRef<HTMLButtonElement, IButton>(
  (
    {
      variant,
      disabled,
      onClick,
      className,
      children,
      isSpinning = false,
      wrapperClass,
      ...props
    },
    ref,
  ) => {
    const control = useAnimationControls();

    const enterAnimation: AnimationDefinition = {
      scale: 0.97,
    };

    const leaveAnimation: AnimationDefinition = {
      scale: 1,
      transition: { duration: 0.4 },
    };

    return (
      <motion.div animate={control} className={cn("w-min", wrapperClass)}>
        <Btn
          ref={ref}
          onPressStart={() => {
            if (!isSpinning) {
              control.stop();
              control.start(enterAnimation);
            }
          }}
          onPressEnd={() => {
            if (!isSpinning) {
              control.start(leaveAnimation);
            }
          }}
          onPress={onClick}
          isDisabled={disabled || isSpinning}
          className={cn(ButtonVariants({ variant, className }))}
          {...props}
        >
          {children}
        </Btn>
      </motion.div>
    );
  },
);

Button.displayName = "Button";

export { Button };
