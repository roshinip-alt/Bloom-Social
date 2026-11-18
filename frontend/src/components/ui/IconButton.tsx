import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { Tooltip } from './Tooltip';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: used as the accessible name and the tooltip. */
  label: string;
  icon: ReactNode;
  size?: 'sm' | 'md';
  tooltip?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, icon, size = 'md', tooltip = true, className, type = 'button', ...props }, ref) => {
    const button = (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-md text-fg-2 transition-colors hover:bg-surface-2 hover:text-fg active:bg-border/60 disabled:pointer-events-none disabled:opacity-50 [&_svg]:h-4 [&_svg]:w-4',
          size === 'sm' ? 'h-7 w-7' : 'h-8 w-8',
          className,
        )}
        {...props}
      >
        {icon}
      </button>
    );
    return tooltip ? <Tooltip content={label}>{button}</Tooltip> : button;
  },
);
IconButton.displayName = 'IconButton';
