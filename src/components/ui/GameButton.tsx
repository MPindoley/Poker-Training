import { motion, type HTMLMotionProps } from 'framer-motion';
import type { ReactNode } from 'react';

export type ButtonColor = 'green' | 'gold' | 'blue' | 'red' | 'purple' | 'cream';
export type ButtonSize = 'sm' | 'md' | 'lg';

const COLORS: Record<ButtonColor, string> = {
  green: 'bg-gradient-to-b from-felt-300 to-emerald-dark text-white',
  gold: 'bg-gradient-to-b from-gold-300 to-gold-700 text-ink',
  blue: 'bg-gradient-to-b from-[#6fb2ff] to-sapphire-dark text-white',
  red: 'bg-gradient-to-b from-[#ff7a6e] to-ruby-dark text-white',
  purple: 'bg-gradient-to-b from-[#b88bff] to-grape-dark text-white',
  cream: 'bg-gradient-to-b from-white to-cream-dark text-ink',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-10 px-4 text-base rounded-xl gap-1.5',
  md: 'h-13 px-5 text-xl rounded-2xl gap-2',
  lg: 'h-16 px-6 text-2xl rounded-[1.25rem] gap-2.5',
};

export interface GameButtonProps extends Omit<HTMLMotionProps<'button'>, 'children' | 'color'> {
  color?: ButtonColor;
  size?: ButtonSize;
  icon?: ReactNode;
  fullWidth?: boolean;
  children?: ReactNode;
}

/** Big chunky, glossy button that squashes when tapped. */
export function GameButton({
  color = 'green',
  size = 'md',
  icon,
  fullWidth,
  disabled,
  className = '',
  children,
  ...rest
}: GameButtonProps) {
  const light = color === 'gold' || color === 'cream';
  return (
    <motion.button
      type="button"
      disabled={disabled}
      whileTap={disabled ? undefined : { scaleX: 1.05, scaleY: 0.9, y: 4, boxShadow: '0 1px 0 0 var(--color-ink)' }}
      whileHover={disabled ? undefined : { y: -1 }}
      transition={{ type: 'spring', stiffness: 600, damping: 15 }}
      className={[
        'gloss inline-flex select-none items-center justify-center border-[3px] border-ink font-display tracking-wide',
        'shadow-chunky outline-none focus-visible:ring-4 focus-visible:ring-gold-300',
        COLORS[color],
        SIZES[size],
        fullWidth ? 'w-full' : '',
        disabled ? 'opacity-50 grayscale-[0.4] cursor-not-allowed' : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {icon && <span className="grid place-items-center [&>svg]:h-[1.1em] [&>svg]:w-[1.1em]">{icon}</span>}
      {children && <span className={light ? '' : 'text-outline-sm'}>{children}</span>}
    </motion.button>
  );
}
