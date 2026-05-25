import { useEffect, useState, type CSSProperties } from 'react';
import { MapPin, Phone, Clock, Star, ExternalLink, X, Navigation } from 'lucide-react';

export type ClinicDetail = {
  id: string;
  name: string;
  location: string;
  specialties: string[];
  rating: number;
  distance: string;
  image_url?: string;
  phone?: string;
  hours?: string;
  website?: string;
  mapUrl?: string;
};

type Props = {
  open: boolean;
  clinic: ClinicDetail | null;
  onClose: () => void;
};

export function ClinicDetailModal({ open, clinic, onClose }: Props) {
  const [visible, setVisible] = useState(false);
  const [animIn, setAnimIn] = useState(false);

  useEffect(() => {
    if (open) {
      setVisible(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimIn(true)));
    } else {
      setAnimIn(false);
      const t = setTimeout(() => setVisible(false), 320);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!visible || !clinic) return null;

  const openExternal = (url?: string) => {
    if (url) window.open(url, '_blank', 'noopener');
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{ ...BACKDROP, opacity: animIn ? 1 : 0 }}
      />
      <div style={{ ...SHEET, transform: animIn ? 'translateY(0)' : 'translateY(100%)' }}>
        {/* Handle bar */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(123,140,118,0.2)' }} />
        </div>

        <div style={{ padding: '16px 24px 32px', overflowY: 'auto' }}>
          {/* Header with image */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            <div style={IMG_WRAP}>
              <img src={clinic.image_url ?? ''} alt={clinic.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: '#2a2a2a', lineHeight: 1.3 }}>
                  {clinic.name}
                </h3>
                <button onClick={onClose} style={CLOSE_BTN}>
                  <X size={16} color="#5a4a3a" />
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
                <Star size={14} color="#D7C8B0" fill="#D7C8B0" />
                <span style={{ fontSize: 14, fontWeight: 500, color: '#2a2a2a' }}>{clinic.rating}</span>
                <span style={{ fontSize: 12, color: '#9a8e80', marginLeft: 8 }}>{clinic.distance}</span>
              </div>
            </div>
          </div>

          {/* Info rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
            <div style={INFO_ROW}>
              <MapPin size={16} color="#7b8c76" />
              <span style={{ fontSize: 13, color: '#5a4a3a', flex: 1 }}>{clinic.location}</span>
            </div>
            {clinic.hours && (
              <div style={INFO_ROW}>
                <Clock size={16} color="#7b8c76" />
                <span style={{ fontSize: 13, color: '#5a4a3a', flex: 1 }}>{clinic.hours}</span>
              </div>
            )}
            {clinic.phone && (
              <div style={INFO_ROW}>
                <Phone size={16} color="#7b8c76" />
                <a href={`tel:${clinic.phone}`} style={{ fontSize: 13, color: '#7b8c76', textDecoration: 'none' }}>
                  {clinic.phone}
                </a>
              </div>
            )}
          </div>

          {/* Specialties */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
            {clinic.specialties.map((s, i) => (
              <span key={i} style={TAG}>
                {s}
              </span>
            ))}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => openExternal(clinic.mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clinic.location)}`)}
              style={BTN_SECONDARY}
            >
              <Navigation size={16} />
              <span>导航</span>
            </button>
            <button
              onClick={() => openExternal(clinic.website)}
              style={BTN_PRIMARY}
            >
              <ExternalLink size={16} />
              <span>预约</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const BACKDROP: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 190,
  background: 'rgba(0,0,0,0.4)',
  transition: 'opacity 0.3s ease',
};
const SHEET: CSSProperties = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  zIndex: 191,
  background: '#fff',
  borderRadius: '24px 24px 0 0',
  boxShadow: '0 -8px 30px rgba(0,0,0,0.12)',
  transition: 'transform 0.3s ease',
  maxHeight: '80vh',
  display: 'flex',
  flexDirection: 'column',
};
const IMG_WRAP: CSSProperties = {
  width: 72,
  height: 72,
  borderRadius: 16,
  overflow: 'hidden',
  flexShrink: 0,
  background: '#f8f3ee',
};
const CLOSE_BTN: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 999,
  border: 'none',
  background: 'rgba(123,140,118,0.1)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};
const INFO_ROW: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 10,
};
const TAG: CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  padding: '4px 10px',
  borderRadius: 999,
  background: 'rgba(240,230,220,0.6)',
  color: '#7b8c76',
  border: '1px solid rgba(123,140,118,0.12)',
};
const BTN_SECONDARY: CSSProperties = {
  flex: 1,
  height: 48,
  borderRadius: 16,
  border: '1.18px solid rgba(123,140,118,0.3)',
  background: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  fontSize: 15,
  fontWeight: 500,
  color: '#7b8c76',
  cursor: 'pointer',
};
const BTN_PRIMARY: CSSProperties = {
  flex: 1,
  height: 48,
  borderRadius: 16,
  border: 'none',
  background: '#7b8c76',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  fontSize: 15,
  fontWeight: 500,
  color: '#fff',
  cursor: 'pointer',
  boxShadow: '0 4px 8px rgba(123,140,118,0.25)',
};
