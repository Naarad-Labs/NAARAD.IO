-- Reverses 0008_consent_ledger.sql.
--
-- Drops the indexes first, then the table. All data is lost, which is
-- expected when rolling back a consent ledger feature. Any application
-- code that relied on consent tracking will need to be removed.

drop index if exists public.consents_purpose_idx;
drop index if exists public.consents_user_purpose_idx;

drop table if exists public.consents;