-- DSR TRACTORS Master Seed Data
-- Run this in your Supabase SQL Editor after running schema.sql

-- 1. SEED SERVICES (Global defaults, user_id IS NULL)
INSERT INTO public.services (name, unit, rate, has_worker_types, worker_rate, no_worker_rate, is_active)
VALUES
    ('5-Kalappai', 'hour', 1200.00, FALSE, NULL, NULL, TRUE),
    ('9-Kalappai', 'hour', 1200.00, FALSE, NULL, NULL, TRUE),
    ('Paar Kalappai', 'hour', 1200.00, FALSE, NULL, NULL, TRUE),
    ('Rotavator', 'hour', 1300.00, FALSE, NULL, NULL, TRUE),
    ('Tanker', 'load', 1000.00, FALSE, NULL, NULL, TRUE),
    ('Solam', 'bundle', 0.00, TRUE, 100.00, 75.00, TRUE),
    ('Manjal', 'load', 1000.00, FALSE, NULL, NULL, TRUE)
ON CONFLICT DO NOTHING;

-- 2. SEED TRACTORS (Global defaults, user_id IS NULL)
-- Initial starting fuel balances can be set per tractor
INSERT INTO public.tractors (name, current_fuel_litres, is_active)
VALUES
    ('SWARAJ 50HP', 0.00, TRUE),
    ('SWARAJ 46HP', 0.00, TRUE),
    ('SWARAJ (OLD)', 0.00, TRUE)
ON CONFLICT DO NOTHING;

-- 3. SEED SETTINGS (Global default diesel price)
INSERT INTO public.settings (user_id, key, value)
VALUES
    (NULL, 'diesel_price', '100.50')
ON CONFLICT DO NOTHING;
