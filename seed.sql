-- Seed data — apply with `npm run db:seed:local` / `db:seed:remote`.
-- Idempotent: INSERT OR REPLACE so re-running just updates rows.

INSERT OR REPLACE INTO products (id, name, description, price_hkd, category, source, image_url) VALUES
  ('t1', '枸杞红枣茶', '补血补气，安神养心', 68, 'tea', 'HKTVmall', '/assets/product-chicken-soup.png'),
  ('t2', '菊花决明子茶', '清肝热，护眼明目', 58, 'tea', 'HKTVmall', '/assets/product-mushroom.png'),
  ('s1', '虫草党参益气鸡汤', '益气健脾，提升免疫力', 188, 'soup', '余仁生', '/assets/product-chicken-soup.png'),
  ('s2', '花胶响螺元贝猪腱汤', '滋阴养颜，补气养血', 268, 'soup', '余仁生', '/assets/product-soup-pork.png'),
  ('s4', '药膳菌菇汤包', '鲜美菌菇，温中补脾', 88, 'soup', 'HKTVmall', '/assets/product-mushroom.png'),
  ('p3', '极品阿胶', '滋阴补血，润燥养颜', 980, 'paste', 'HKTVmall', '/assets/product-ejiao.png');

INSERT OR REPLACE INTO clinics (id, name, location, specialties, rating, distance, image_url) VALUES
  ('c1', '香港理工大学医疗保健处', '九龙红磡 香港理工大学 A001室', '["全科医疗","中医咨询","学生职员保健"]', 4.9, '0.1km', '/assets/clinic-polyu.png'),
  ('c2', '香港浸会大学尖沙咀中医药诊所', '九龙尖沙咀堪富利士道12号', '["针灸理疗","内科调理","骨伤推拿"]', 4.8, '1.2km', '/assets/clinic-hkbu-lsc.png'),
  ('c3', '雷生春堂-浸会大学中医药学院', '九龙旺角荔枝角道119号', '["中医全科","名医会诊","膏方定制"]', 4.9, '2.5km', '/assets/clinic-hkbu-lsc.png'),
  ('c4', '农本方中医诊所', '九龙尖沙咀广东道33号中港城地下', '["中医全科","针灸推拿","浓缩中药"]', 4.7, '2.1km', '/assets/clinic-purapharm.png');
