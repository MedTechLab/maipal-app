import type { CSSProperties } from 'react';
import { useApp } from '../contexts/AppContext';

// Digital-human avatar: two muted looping videos cross-faded by speaking state.
export function DoctorAvatar({ height = 360 }: { height?: number }) {
  const { avatarState } = useApp();
  const speaking = avatarState === 'speaking';

  const layer: CSSProperties = {
    position: 'absolute',
    inset: 0,
    height: '100%',
    width: '100%',
    objectFit: 'contain',
    objectPosition: 'bottom',
    transition: 'opacity 150ms ease',
  };

  return (
    <div
      style={{
        position: 'relative',
        height,
        width: Math.round(height * 0.53),
        pointerEvents: 'none',
      }}
    >
      <video
        src="/assets/mai-standby.mp4"
        autoPlay
        loop
        muted
        playsInline
        style={{ ...layer, opacity: speaking ? 0 : 1 }}
      />
      <video
        src="/assets/mai-speaking.mp4"
        autoPlay
        loop
        muted
        playsInline
        style={{ ...layer, opacity: speaking ? 1 : 0 }}
      />
    </div>
  );
}
