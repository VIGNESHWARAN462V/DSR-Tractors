-- ========================================================
-- DSR TRACTORS — Supabase Seed Data
-- ========================================================

-- Settings
insert into public.settings (key, value) values
  ('business_name', 'DSR TRACTORS'),
  ('diesel_price', '100.50'),
  ('diesel_consumption_rate', '4.0')
on conflict (key) do update set value = excluded.value;

-- Tractors
insert into public.tractors (name, active, current_fuel_litres) values
  ('SWARAJ 50HP', true, 28.50),
  ('SWARAJ 46HP', true, 17.25),
  ('SWARAJ (OLD)', true, 12.40)
on conflict (name) do nothing;

-- Services Master Data
insert into public.services (name, category, unit, rate, worker_type) values
  ('5-Kalappai', 'machinery', 'hour', 1200.00, null),
  ('9-Kalappai', 'machinery', 'hour', 1200.00, null),
  ('Paar Kalappai', 'machinery', 'hour', 1200.00, null),
  ('Rotavator', 'machinery', 'hour', 1300.00, null),
  ('Tanker', 'machinery', 'load', 1000.00, null),
  ('Solam – ஆள் உண்டு', 'crop', 'bundle', 100.00, 'ஆள் உண்டு'),
  ('Solam – ஆள் இல்லை', 'crop', 'bundle', 75.00, 'ஆள் இல்லை'),
  ('Solam (ஆள் உண்டு)', 'crop', 'bundle', 100.00, 'ஆள் உண்டு'),
  ('Solam (ஆள் இல்லை)', 'crop', 'bundle', 75.00, 'ஆள் இல்லை'),
  ('Manjal', 'crop', 'load', 1000.00, null)
on conflict do nothing;

-- Sample Customers
insert into public.customers (name, phone, location, address, notes) values
  ('K. Ramesh', '9842154321', 'Kovilur', 'North Street, Near Temple', 'Regular customer for Rotavator'),
  ('M. Suresh', '9789123456', 'Alangudi', 'Main Road', 'Paddy field work'),
  ('P. Murugan', '9443219876', 'Pudukkottai', 'Bypass Road', 'Needs 5-Kalappai and Tanker water'),
  ('S. Anbarasan', '9865432109', 'Karambakkudi', 'East Field', 'Solam cutting in harvest season'),
  ('V. Palanisamy', '9944112233', 'Gandarvakottai', 'Thottam 4th cross', 'Turmeric (Manjal) transport')
on conflict do nothing;
