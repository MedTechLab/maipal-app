-- AI layer: persist the full GENERATE_REPORT object alongside the existing
-- 3-field summary so the report-detail view can render the rich 四诊 report.
ALTER TABLE health_reports ADD COLUMN report_json TEXT;
