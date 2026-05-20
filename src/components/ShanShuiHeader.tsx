import type { ReactNode } from 'react';

type Props = {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
};

export function ShanShuiHeader({ title, subtitle, right, children }: Props) {
  return (
    <div className="shanshui-head">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {typeof title === 'string' ? (
          <h1 className="mp-h1">{title}</h1>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{title}</div>
        )}
        {subtitle && (
          <p style={{ margin: '4px 0 0', fontSize: 14, color: '#6b5d4f' }}>{subtitle}</p>
        )}
        {children}
      </div>
      {right}
    </div>
  );
}
