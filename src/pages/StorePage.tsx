import { useEffect, useState } from 'react';
import { ExternalLink, MapPin, ShoppingCart, Star } from 'lucide-react';
import { ShanShuiBackground } from '../components/ShanShuiBackground';
import { ShanShuiHeader } from '../components/ShanShuiHeader';
import { PointsPill } from '../components/PointsPill';
import { useApp } from '../contexts/AppContext';
import { api, type Clinic, type Product } from '../lib/api';

// Fallback data used if the API isn't reachable yet (e.g. before
// `wrangler d1 execute --file=./migrations/0002_seed.sql` has been run).
const FALLBACK_PRODUCTS: Product[] = [
  { id: 't1', name: '枸杞红枣茶', description: '补血补气，安神养心', price_hkd: 68, source: 'HKTVmall', category: 'tea', image_url: '/assets/product-chicken-soup.png' },
  { id: 't2', name: '菊花决明子茶', description: '清肝热，护眼明目', price_hkd: 58, source: 'HKTVmall', category: 'tea', image_url: '/assets/product-mushroom.png' },
  { id: 's1', name: '虫草党参益气鸡汤', description: '益气健脾，提升免疫力', price_hkd: 188, source: '余仁生', category: 'soup', image_url: '/assets/product-chicken-soup.png' },
  { id: 's2', name: '花胶响螺元贝猪腱汤', description: '滋阴养颜，补气养血', price_hkd: 268, source: '余仁生', category: 'soup', image_url: '/assets/product-soup-pork.png' },
  { id: 's4', name: '药膳菌菇汤包', description: '鲜美菌菇，温中补脾', price_hkd: 88, source: 'HKTVmall', category: 'soup', image_url: '/assets/product-mushroom.png' },
  { id: 'p3', name: '极品阿胶', description: '滋阴补血，润燥养颜', price_hkd: 980, source: 'HKTVmall', category: 'paste', image_url: '/assets/product-ejiao.png' },
];

const FALLBACK_CLINICS: Clinic[] = [
  { id: 'c1', name: '香港理工大学医疗保健处', location: '九龙红磡 香港理工大学 A001室', specialties: ['全科医疗', '中医咨询', '学生职员保健'], rating: 4.9, distance: '0.1km', image_url: '/assets/clinic-polyu.png' },
  { id: 'c2', name: '香港浸会大学尖沙咀中医药诊所', location: '九龙尖沙咀堪富利士道12号', specialties: ['针灸理疗', '内科调理', '骨伤推拿'], rating: 4.8, distance: '1.2km', image_url: '/assets/clinic-hkbu-lsc.png' },
  { id: 'c3', name: '雷生春堂-浸会大学中医药学院', location: '九龙旺角荔枝角道119号', specialties: ['中医全科', '名医会诊', '膏方定制'], rating: 4.9, distance: '2.5km', image_url: '/assets/clinic-hkbu-lsc.png' },
  { id: 'c4', name: '农本方中医诊所', location: '九龙尖沙咀广东道33号中港城地下', specialties: ['中医全科', '针灸推拿', '浓缩中药'], rating: 4.7, distance: '2.1km', image_url: '/assets/clinic-purapharm.png' },
];

const CATS = [
  { id: 'all', label: '全部' },
  { id: 'tea', label: '养生茶饮' },
  { id: 'soup', label: '炖汤炖盅' },
  { id: 'paste', label: '膏方补品' },
] as const;

export function StorePage() {
  const { points } = useApp();
  const [tab, setTab] = useState<'food' | 'doctor'>('food');
  const [cat, setCat] = useState<(typeof CATS)[number]['id']>('all');
  const [products, setProducts] = useState<Product[]>(FALLBACK_PRODUCTS);
  const [clinics, setClinics] = useState<Clinic[]>(FALLBACK_CLINICS);

  useEffect(() => {
    api.listProducts().then(setProducts).catch(() => undefined);
    api.listClinics().then(setClinics).catch(() => undefined);
  }, []);

  const visible =
    cat === 'all' ? products : products.filter((p) => p.category === cat);

  return (
    <div className="app-frame mp-screen" style={{ position: 'relative' }}>
      <ShanShuiBackground />
      <div style={{ position: 'relative', zIndex: 10, height: '100%', overflowY: 'auto' }}>
        <ShanShuiHeader
          title={
            <>
              <h1 className="mp-h1" style={{ margin: 0 }}>中医馆</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <MapPin size={14} color="#7b8c76" />
                <span
                  style={{
                    fontSize: 11,
                    color: '#6b5d4f',
                    fontFamily: 'var(--font-sans)',
                    filter: 'none',
                  }}
                >
                  香港理工大学
                </span>
              </div>
            </>
          }
          right={
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <PointsPill points={points} />
              <p style={{ margin: '4px 8px 0 0', fontSize: 10, color: '#6b5d4f' }}>
                100积分可抵扣HK$5
              </p>
            </div>
          }
        />

        <div style={{ padding: '0 24px', marginBottom: 16 }}>
          <div
            style={{
              background: 'rgba(255,255,255,0.95)',
              borderRadius: 16,
              padding: 4,
              display: 'flex',
              boxShadow: '0 4px 8px rgba(107,93,79,0.05)',
              border: '1.18px solid rgba(123,140,118,0.1)',
            }}
          >
            {[
              { id: 'food', label: '药膳房' },
              { id: 'doctor', label: '看医生' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id as 'food' | 'doctor')}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  borderRadius: 12,
                  border: 'none',
                  fontSize: 16,
                  fontWeight: 500,
                  cursor: 'pointer',
                  background: tab === t.id ? '#7b8c76' : 'transparent',
                  color: tab === t.id ? '#fff' : '#6b5d4f',
                  boxShadow: tab === t.id ? '0 2px 4px rgba(0,0,0,.08)' : 'none',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {tab === 'food' && (
          <div
            style={{
              padding: '0 24px',
              marginBottom: 12,
              display: 'flex',
              gap: 8,
              overflowX: 'auto',
            }}
          >
            {CATS.map((c) => (
              <button
                key={c.id}
                onClick={() => setCat(c.id)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 999,
                  fontSize: 14,
                  fontWeight: 500,
                  background: cat === c.id ? '#7b8c76' : 'rgba(255,255,255,0.9)',
                  color: cat === c.id ? '#fff' : '#6b5d4f',
                  border:
                    cat === c.id ? 'none' : '1.18px solid rgba(111,184,153,0.15)',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}

        <div style={{ padding: '12px 24px 32px' }}>
          {tab === 'food' ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 16,
              }}
            >
              {visible.map((p) => (
                <div
                  key={p.id}
                  className="mp-card"
                  style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
                >
                  <div
                    style={{ aspectRatio: '1/1', background: '#f8f3ee', overflow: 'hidden' }}
                  >
                    <img
                      src={p.image_url ?? ''}
                      alt={p.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                  <div
                    style={{
                      padding: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      flex: 1,
                    }}
                  >
                    <span
                      style={{
                        alignSelf: 'flex-start',
                        color: '#6b5d4f',
                        fontSize: 10,
                        fontWeight: 500,
                        background: '#f0e6dc',
                        padding: '2px 6px',
                        borderRadius: 4,
                      }}
                    >
                      {p.source}
                    </span>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: 14,
                        fontWeight: 500,
                        color: '#2a2a2a',
                        lineHeight: 1.3,
                      }}
                    >
                      {p.name}
                    </h3>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 11,
                        color: '#6b5d4f',
                        lineHeight: 1.4,
                        flex: 1,
                      }}
                    >
                      {p.description}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#7b8c76' }}>
                        HK${p.price_hkd}
                      </span>
                      <button
                        style={{
                          background: '#7b8c76',
                          color: '#fff',
                          border: 'none',
                          padding: '5px 12px',
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 500,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          cursor: 'pointer',
                          boxShadow: '0 2px 4px rgba(0,0,0,.1)',
                          fontFamily: 'var(--font-sans)',
                        }}
                      >
                        <ExternalLink size={12} />
                        去购买
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {clinics.map((c) => (
                <div key={c.id} className="mp-card" style={{ padding: 18, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', gap: 14 }}>
                    <div
                      style={{
                        width: 60,
                        height: 60,
                        borderRadius: 12,
                        background: '#f8f3ee',
                        overflow: 'hidden',
                        flexShrink: 0,
                      }}
                    >
                      <img
                        src={c.image_url ?? ''}
                        alt={c.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          marginBottom: 6,
                        }}
                      >
                        <h3
                          style={{
                            margin: 0,
                            fontSize: 15,
                            fontWeight: 500,
                            color: '#2a2a2a',
                            lineHeight: 1.25,
                            paddingRight: 8,
                          }}
                        >
                          {c.name}
                        </h3>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            flexShrink: 0,
                          }}
                        >
                          <Star size={14} color="#D7C8B0" fill="#D7C8B0" />
                          <span
                            style={{ fontSize: 13, fontWeight: 500, color: '#2a2a2a' }}
                          >
                            {c.rating}
                          </span>
                        </div>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 6,
                          marginBottom: 8,
                        }}
                      >
                        <MapPin size={14} color="#6b5d4f" />
                        <p
                          style={{
                            margin: 0,
                            fontSize: 12,
                            color: '#6b5d4f',
                            flex: 1,
                            lineHeight: 1.3,
                          }}
                        >
                          {c.location}
                        </p>
                        <span
                          style={{ fontSize: 12, color: '#6b5d4f', flexShrink: 0 }}
                        >
                          {c.distance}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {c.specialties.map((s, i) => (
                          <span
                            key={i}
                            style={{
                              background: '#f0e6dc',
                              color: '#7b8c76',
                              padding: '2px 10px',
                              borderRadius: 999,
                              fontSize: 11,
                              border: '1.18px solid rgba(123,140,118,0.15)',
                            }}
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {tab === 'food' && (
        <div style={{ position: 'absolute', bottom: 16, right: 24, zIndex: 50 }}>
          <button
            aria-label="购物车"
            style={{
              width: 56,
              height: 56,
              borderRadius: 999,
              background: '#7b8c76',
              color: '#fff',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(123,140,118,0.4)',
              cursor: 'pointer',
            }}
          >
            <ShoppingCart size={22} />
          </button>
        </div>
      )}
    </div>
  );
}
