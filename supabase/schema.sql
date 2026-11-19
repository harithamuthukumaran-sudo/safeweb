-- ============================================================
-- SafeWeb PostgreSQL Schema
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ─────────────────────────────────────────────────────────────
-- TABLE: scans
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.scans (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    url              TEXT        NOT NULL,
    final_url        TEXT        NOT NULL,
    scanned_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    risk_score       INTEGER     NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
    classification   TEXT        NOT NULL CHECK (classification IN ('safe', 'suspicious', 'dangerous')),
    label            TEXT        NOT NULL,
    disclaimer       TEXT        NOT NULL,
    ssl_has_ssl          BOOLEAN,
    ssl_is_valid         BOOLEAN,
    ssl_issuer           TEXT,
    ssl_days_until_expiry INTEGER,
    ssl_protocol_version TEXT,
    ssl_is_expired       BOOLEAN,
    ssl_is_expiring_soon BOOLEAN,
    ssl_error_message    TEXT,
    uptime_is_online            BOOLEAN,
    uptime_status_code          INTEGER,
    uptime_response_time_ms     NUMERIC,
    uptime_latency_classification TEXT,
    full_result      JSONB       NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scans_user_id    ON public.scans(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_url        ON public.scans(url);
CREATE INDEX IF NOT EXISTS idx_scans_scanned_at ON public.scans(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_risk_score ON public.scans(risk_score);


-- ─────────────────────────────────────────────────────────────
-- TABLE: monitored_sites
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.monitored_sites (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    url           TEXT        NOT NULL,
    label         TEXT,
    check_interval_hours INTEGER NOT NULL DEFAULT 24
        CHECK (check_interval_hours >= 1 AND check_interval_hours <= 168),
    alert_on_offline         BOOLEAN NOT NULL DEFAULT TRUE,
    alert_on_new_threat      BOOLEAN NOT NULL DEFAULT TRUE,
    alert_on_score_increase  BOOLEAN NOT NULL DEFAULT TRUE,
    score_change_threshold   INTEGER NOT NULL DEFAULT 15
        CHECK (score_change_threshold >= 5 AND score_change_threshold <= 50),
    is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
    last_checked_at  TIMESTAMPTZ,
    last_risk_score  INTEGER     CHECK (last_risk_score >= 0 AND last_risk_score <= 100),
    last_status_code INTEGER,
    last_is_online   BOOLEAN,
    next_check_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, url)
);

CREATE INDEX IF NOT EXISTS idx_monitored_active        ON public.monitored_sites(is_active);
CREATE INDEX IF NOT EXISTS idx_monitored_next_check    ON public.monitored_sites(next_check_at)
    WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_monitored_user_id       ON public.monitored_sites(user_id);


-- ─────────────────────────────────────────────────────────────
-- TABLE: alerts
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.alerts (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    monitored_site_id   UUID        NOT NULL REFERENCES public.monitored_sites(id) ON DELETE CASCADE,
    url                 TEXT        NOT NULL,
    alert_type          TEXT        NOT NULL CHECK (alert_type IN (
                                        'site_offline',
                                        'site_recovered',
                                        'new_threat_detected',
                                        'threat_cleared',
                                        'risk_score_increased',
                                        'ssl_expired',
                                        'ssl_expiring_soon'
                                    )),
    severity            TEXT        NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    title               TEXT        NOT NULL,
    message             TEXT        NOT NULL,
    previous_risk_score INTEGER,
    new_risk_score      INTEGER,
    is_read             BOOLEAN     NOT NULL DEFAULT FALSE,
    triggered_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    scan_id             UUID        REFERENCES public.scans(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_alerts_user_id     ON public.alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_unread      ON public.alerts(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_alerts_triggered   ON public.alerts(triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_site        ON public.alerts(monitored_site_id);


-- ─────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY POLICIES
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.scans           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitored_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts          ENABLE ROW LEVEL SECURITY;

-- scans policies
CREATE POLICY "users_own_scans_select"
    ON public.scans FOR SELECT
    USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "users_own_scans_insert"
    ON public.scans FOR INSERT
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "users_own_scans_delete"
    ON public.scans FOR DELETE
    USING (auth.uid() = user_id);

-- monitored_sites policies
CREATE POLICY "users_own_monitored_select"
    ON public.monitored_sites FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "users_own_monitored_insert"
    ON public.monitored_sites FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_own_monitored_update"
    ON public.monitored_sites FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_own_monitored_delete"
    ON public.monitored_sites FOR DELETE
    USING (auth.uid() = user_id);

-- alerts policies
CREATE POLICY "users_own_alerts_select"
    ON public.alerts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "users_own_alerts_update"
    ON public.alerts FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_own_alerts_delete"
    ON public.alerts FOR DELETE
    USING (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────
-- FUNCTION: auto-update updated_at on monitored_sites
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_monitored_sites_updated_at
    BEFORE UPDATE ON public.monitored_sites
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
