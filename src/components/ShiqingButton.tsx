import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary';
  block?: boolean;
  children: ReactNode;
};

export function ShiqingButton({
  variant = 'primary',
  block,
  className,
  children,
  ...rest
}: Props) {
  const cls = [
    'mp-btn-pri',
    variant === 'secondary' && 'mp-btn-sec',
    block && 'mp-btn-block',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}
