-- ============================================================
-- BAKHMACH DEMO CITY - SEED DATA SCRIPT
-- ============================================================
-- Purpose: Generate realistic demo data for Bakhmach city
-- Data: 1 city, 5 businesses, 20 contracts, 15 incidents
-- Execution time: <30 seconds
-- ============================================================

-- Enable transaction mode for atomicity
BEGIN TRANSACTION;

-- ============================================================
-- 1. CITY DATA
-- ============================================================
INSERT INTO cities (city_id, city_name, region, country, population, founded_year)
VALUES 
  ('bakhmach_001', 'Bakhmach', 'Chernihiv Oblast', 'Ukraine', 18500, 1890);

-- ============================================================
-- 2. BUSINESSES (5 companies)
-- ============================================================
INSERT INTO businesses (business_id, city_id, business_name, industry, registration_date, status)
VALUES
  ('biz_001', 'bakhmach_001', 'Bakhmach Energy Supply', 'Utilities', '2020-03-15', 'active'),
  ('biz_002', 'bakhmach_001', 'Chernihiv Transport Co', 'Logistics', '2019-07-22', 'active'),
  ('biz_003', 'bakhmach_001', 'Bakhmach Medical Center', 'Healthcare', '2018-11-10', 'active'),
  ('biz_004', 'bakhmach_001', 'Agricultural Co-op Prosperity', 'Agriculture', '2021-01-05', 'active'),
  ('biz_005', 'bakhmach_001', 'Bakhmach Municipal Services', 'Government', '2015-02-01', 'active');

-- ============================================================
-- 3. CONTRACTS (20 contracts)
-- ============================================================
INSERT INTO contracts (contract_id, business_id, contract_type, contract_value, start_date, end_date, status)
VALUES
  ('contract_001', 'biz_001', 'Energy Supply', 150000.00, '2023-01-01', '2026-12-31', 'active'),
  ('contract_002', 'biz_001', 'Maintenance Services', 45000.00, '2023-03-15', '2024-03-15', 'active'),
  ('contract_003', 'biz_002', 'Transport Contract', 200000.00, '2023-02-01', '2025-02-01', 'active'),
  ('contract_004', 'biz_002', 'Fuel Supply', 80000.00, '2023-05-10', '2024-05-10', 'expired'),
  ('contract_005', 'biz_002', 'Vehicle Maintenance', 55000.00, '2023-06-01', '2025-06-01', 'active'),
  ('contract_006', 'biz_003', 'Medical Supplies', 120000.00, '2023-01-15', '2024-01-15', 'active'),
  ('contract_007', 'biz_003', 'Staffing Services', 180000.00, '2023-03-01', '2026-03-01', 'active'),
  ('contract_008', 'biz_003', 'Equipment Lease', 75000.00, '2023-04-01', '2025-04-01', 'active'),
  ('contract_009', 'biz_004', 'Seed Supply Contract', 90000.00, '2023-02-01', '2024-02-01', 'active'),
  ('contract_010', 'biz_004', 'Equipment Rental', 65000.00, '2023-03-15', '2024-09-15', 'active'),
  ('contract_011', 'biz_004', 'Fertilizer Supply', 110000.00, '2023-04-01', '2025-03-31', 'active'),
  ('contract_012', 'biz_004', 'Storage Facility', 35000.00, '2023-05-01', '2025-04-30', 'active'),
  ('contract_013', 'biz_004', 'Transportation Services', 55000.00, '2023-06-01', '2024-11-30', 'active'),
  ('contract_014', 'biz_005', 'Waste Management', 125000.00, '2023-01-01', '2025-12-31', 'active'),
  ('contract_015', 'biz_005', 'Street Cleaning', 75000.00, '2023-02-01', '2024-12-31', 'active'),
  ('contract_016', 'biz_005', 'Utilities Management', 95000.00, '2023-03-15', '2025-03-14', 'active'),
  ('contract_017', 'biz_005', 'Park Maintenance', 45000.00, '2023-04-01', '2024-03-31', 'expired'),
  ('contract_018', 'biz_001', 'Emergency Response', 85000.00, '2023-07-01', '2024-06-30', 'active'),
  ('contract_019', 'biz_002', 'Cargo Insurance', 65000.00, '2023-08-01', '2025-07-31', 'active'),
  ('contract_020', 'biz_003', 'Emergency Medicine', 140000.00, '2023-09-01', '2026-08-31', 'active');

-- ============================================================
-- 4. INCIDENTS (15 incidents)
-- ============================================================
INSERT INTO incidents (incident_id, business_id, contract_id, incident_type, severity, description, reported_date, status)
VALUES
  ('inc_001', 'biz_001', 'contract_001', 'Power Outage', 'HIGH', 'Electrical grid failure affecting 2000+ residents', '2023-11-15', 'resolved'),
  ('inc_002', 'biz_001', 'contract_002', 'Equipment Malfunction', 'MEDIUM', 'Transformer malfunction in substation 3', '2023-11-20', 'in_progress'),
  ('inc_003', 'biz_002', 'contract_003', 'Delivery Delay', 'MEDIUM', 'Logistics delay due to road conditions', '2023-10-22', 'resolved'),
  ('inc_004', 'biz_002', 'contract_003', 'Vehicle Accident', 'HIGH', 'Transport vehicle collision with 1 injury', '2023-11-05', 'resolved'),
  ('inc_005', 'biz_002', 'contract_004', 'Fuel Contamination', 'HIGH', 'Contaminated fuel batch detected', '2023-11-18', 'in_progress'),
  ('inc_006', 'biz_003', 'contract_006', 'Supply Shortage', 'MEDIUM', 'Critical medical supplies out of stock', '2023-11-10', 'resolved'),
  ('inc_007', 'biz_003', 'contract_007', 'Staff Absence', 'MEDIUM', 'Unexpected staff absence reducing capacity by 30%', '2023-11-22', 'in_progress'),
  ('inc_008', 'biz_003', 'contract_008', 'Equipment Failure', 'HIGH', 'MRI machine failure affecting patient care', '2023-11-25', 'urgent'),
  ('inc_009', 'biz_004', 'contract_009', 'Crop Disease', 'HIGH', 'Fungal infection detected in 50% of crop', '2023-10-30', 'resolved'),
  ('inc_010', 'biz_004', 'contract_011', 'Quality Issue', 'MEDIUM', 'Fertilizer batch failed quality testing', '2023-11-12', 'resolved'),
  ('inc_011', 'biz_004', 'contract_013', 'Transport Delay', 'LOW', 'Minor delay in harvest transportation', '2023-11-20', 'resolved'),
  ('inc_012', 'biz_005', 'contract_014', 'Service Disruption', 'MEDIUM', 'Waste collection interrupted for 2 days', '2023-11-08', 'resolved'),
  ('inc_013', 'biz_005', 'contract_015', 'Equipment Breakdown', 'LOW', 'Street cleaning equipment requiring repairs', '2023-11-17', 'resolved'),
  ('inc_014', 'biz_005', 'contract_016', 'System Outage', 'HIGH', 'Utilities management system offline', '2023-11-21', 'in_progress'),
  ('inc_015', 'biz_001', 'contract_018', 'Response Delay', 'MEDIUM', 'Emergency response took 45 minutes vs 15 min SLA', '2023-11-23', 'in_progress');

-- ============================================================
-- 5. VERIFICATION CHECKS
-- ============================================================
-- Check: Bakhmach city exists
SELECT COUNT(*) as city_count FROM cities WHERE city_id = 'bakhmach_001';

-- Check: All 5 businesses inserted
SELECT COUNT(*) as business_count FROM businesses WHERE city_id = 'bakhmach_001';

-- Check: All 20 contracts inserted
SELECT COUNT(*) as contract_count FROM contracts;

-- Check: All 15 incidents inserted
SELECT COUNT(*) as incident_count FROM incidents;

-- ============================================================
-- COMMIT TRANSACTION
-- ============================================================
COMMIT;

-- ============================================================
-- SUCCESS OUTPUT
-- ============================================================
SELECT 
  'BAKHMACH SEED DATA SUCCESSFULLY LOADED' as status,
  (SELECT COUNT(*) FROM cities WHERE city_id = 'bakhmach_001') as cities,
  (SELECT COUNT(*) FROM businesses WHERE city_id = 'bakhmach_001') as businesses,
  (SELECT COUNT(*) FROM contracts) as contracts,
  (SELECT COUNT(*) FROM incidents) as incidents,
  'Ready for demo' as message;
