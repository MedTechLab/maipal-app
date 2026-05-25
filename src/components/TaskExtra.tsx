import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { ChevronRight, ExternalLink, Pause, Play } from 'lucide-react';

export type TaskLink = {
  title: string;
  source: string;
  url: string;
  icon?: string;
};

export type TaskMusic = {
  title: string;
  url: string;
  duration: number; // seconds
};

export type TaskExtraData = {
  links?: TaskLink[];
  music?: TaskMusic;
};

type Props = {
  data: TaskExtraData;
  expanded: boolean;
};

export function TaskExtra({ data, expanded }: Props) {
  if (!expanded) return null;

  return (
    <div style={CONTAINER}>
      {data.links?.map((link, i) => (
        <a
          key={i}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          style={LINK_ROW}
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <div style={LINK_ICON}>
            {link.icon ? (
              <span style={{ fontSize: 16 }}>{link.icon}</span>
            ) : (
              <ExternalLink size={16} color="#7b8c76" />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#2a2a2a', lineHeight: 1.3 }}>
              {link.title}
            </div>
            <div style={{ fontSize: 11, color: '#9a8e80', marginTop: 2 }}>{link.source}</div>
          </div>
          <ChevronRight size={16} color="#9a8e80" />
        </a>
      ))}

      {data.music && <MusicPlayer music={data.music} />}
    </div>
  );
}

function MusicPlayer({ music }: { music: TaskMusic }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const rafRef = useRef<number>(0);

  const updateProgress = useCallback(() => {
    const audio = audioRef.current;
    if (audio && !audio.paused) {
      const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
      setProgress(pct);
      setCurrentTime(audio.currentTime);
      rafRef.current = requestAnimationFrame(updateProgress);
    }
  }, []);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      audioRef.current?.pause();
    };
  }, []);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) {
      const audio = new Audio(music.url);
      audioRef.current = audio;
      audio.addEventListener('ended', () => {
        setPlaying(false);
        setProgress(0);
        setCurrentTime(0);
      });
    }
    const audio = audioRef.current;
    if (playing) {
      audio.pause();
      cancelAnimationFrame(rafRef.current);
      setPlaying(false);
    } else {
      audio.play().catch(() => undefined);
      rafRef.current = requestAnimationFrame(updateProgress);
      setPlaying(true);
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div style={MUSIC_CONTAINER} onClick={(e) => e.stopPropagation()}>
      <button onClick={toggle} style={{ ...MUSIC_BTN, background: playing ? '#7b8c76' : '#D7C8B0' }}>
        {playing ? <Pause size={18} color="#fff" /> : <Play size={18} color="#fff" />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#2a2a2a' }}>{music.title}</span>
          <span style={{ fontSize: 11, color: '#9a8e80' }}>
            {formatTime(currentTime)} / {formatTime(music.duration)}
          </span>
        </div>
        <div style={PROGRESS_BAR_BG}>
          <div
            style={{
              ...PROGRESS_BAR_FILL,
              width: `${progress}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const CONTAINER: CSSProperties = {
  padding: '8px 12px 4px',
  borderTop: '1px solid rgba(123,140,118,0.08)',
  marginTop: 8,
};
const LINK_ROW: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 0',
  borderBottom: '1px solid rgba(123,140,118,0.06)',
  textDecoration: 'none',
  cursor: 'pointer',
};
const LINK_ICON: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  background: 'rgba(123,140,118,0.08)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};
const MUSIC_CONTAINER: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 0 4px',
};
const MUSIC_BTN: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 999,
  border: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  flexShrink: 0,
  transition: 'background 0.2s',
};
const PROGRESS_BAR_BG: CSSProperties = {
  height: 3,
  borderRadius: 2,
  background: 'rgba(215,200,176,0.3)',
  overflow: 'hidden',
};
const PROGRESS_BAR_FILL: CSSProperties = {
  height: '100%',
  borderRadius: 2,
  background: 'linear-gradient(90deg, #22c55e, #7b8c76)',
  transition: 'width 0.3s linear',
};
