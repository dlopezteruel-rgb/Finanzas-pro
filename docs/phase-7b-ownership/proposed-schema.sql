-- DESIGN ONLY. Not a migration, not deployed or executed in 7B.1.
-- Auth0 remains IdP. No financial documents are copied into these metadata tables.
-- Roles/GRANTs/policies require a separate approved and tested implementation.
CREATE SCHEMA proposed_ownership;
CREATE TABLE proposed_ownership.registry_state (
  singleton boolean PRIMARY KEY CHECK (singleton),
  revision bigint NOT NULL CHECK (revision >= 0)
);
CREATE TABLE proposed_ownership.app_user (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revision bigint NOT NULL CHECK (revision >= 0),
  authorization_epoch bigint NOT NULL CHECK (authorization_epoch >= 0),
  status text NOT NULL CHECK (status IN ('active', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE proposed_ownership.external_identity (
  issuer text COLLATE "C" NOT NULL CHECK (issuer <> ''),
  subject text COLLATE "C" NOT NULL CHECK (subject <> ''),
  user_id uuid NOT NULL REFERENCES proposed_ownership.app_user(id) ON DELETE RESTRICT,
  revision bigint NOT NULL CHECK (revision >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (issuer, subject)
  -- No email uniqueness, inferred linking, or automatic ownership transfer.
);
CREATE TABLE proposed_ownership.financial_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revision bigint NOT NULL CHECK (revision >= 0),
  status text NOT NULL CHECK (status IN ('active', 'blocked')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE proposed_ownership.profile_owner (
  profile_id uuid PRIMARY KEY REFERENCES proposed_ownership.financial_profile(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES proposed_ownership.app_user(id) ON DELETE RESTRICT,
  revision bigint NOT NULL CHECK (revision >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX owner_lookup ON proposed_ownership.profile_owner(user_id, profile_id);
CREATE TABLE proposed_ownership.authorization_event (
  decision_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL,
  actor_id uuid REFERENCES proposed_ownership.app_user(id) ON DELETE RESTRICT,
  profile_id uuid REFERENCES proposed_ownership.financial_profile(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('read','write','export','restore','financial-operation')),
  outcome text NOT NULL CHECK (outcome IN ('denied','eligible-in-model')),
  observed_revision bigint CHECK (observed_revision >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
  -- Events are not operation receipts or authorization capabilities.
  -- No raw subject/email/token/request body/financial payload.
);
CREATE TABLE proposed_ownership.registry_operation (
  operation_id uuid PRIMARY KEY,
  actor_id uuid NOT NULL REFERENCES proposed_ownership.app_user(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('provision-user','create-profile')),
  fingerprint bytea NOT NULL CHECK (octet_length(fingerprint) = 32),
  resulting_registry_revision bigint NOT NULL CHECK (resulting_registry_revision >= 0)
);
ALTER TABLE proposed_ownership.registry_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposed_ownership.registry_state FORCE ROW LEVEL SECURITY;
ALTER TABLE proposed_ownership.registry_operation ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposed_ownership.registry_operation FORCE ROW LEVEL SECURITY;
ALTER TABLE proposed_ownership.app_user ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposed_ownership.app_user FORCE ROW LEVEL SECURITY;
ALTER TABLE proposed_ownership.external_identity ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposed_ownership.external_identity FORCE ROW LEVEL SECURITY;
ALTER TABLE proposed_ownership.financial_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposed_ownership.financial_profile FORCE ROW LEVEL SECURITY;
ALTER TABLE proposed_ownership.profile_owner ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposed_ownership.profile_owner FORCE ROW LEVEL SECURITY;
ALTER TABLE proposed_ownership.authorization_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposed_ownership.authorization_event FORCE ROW LEVEL SECURITY;
-- No permissive policies or runtime grants: default denial for non-bypass roles.
-- This is NOT evidence of tested DB isolation. Superusers/BYPASSRLS still bypass RLS.
