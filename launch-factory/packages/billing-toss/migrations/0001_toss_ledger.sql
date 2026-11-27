-- 과거 시험 원장 기록. 적용하지 않는다. 정본은 packages/db/migrations/0020 및 0021이다.
CREATE TABLE toss_ledger_subscriptions (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  customer_key text NOT NULL,
  encrypted_billing_key text,
  plan_id text NOT NULL,
  order_name text NOT NULL,
  amount integer NOT NULL CHECK (amount > 0),
  status text NOT NULL CHECK (status IN ('enabled', 'canceled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE toss_ledger_charges (
  order_id text PRIMARY KEY,
  subscription_id text NOT NULL REFERENCES toss_ledger_subscriptions(id),
  billing_month text NOT NULL CHECK (billing_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  amount integer NOT NULL CHECK (amount > 0),
  status text NOT NULL CHECK (status IN ('in_flight', 'paid')),
  payment_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  UNIQUE (subscription_id, billing_month),
  CHECK ((status = 'paid' AND payment_key IS NOT NULL AND paid_at IS NOT NULL) OR (status = 'in_flight' AND payment_key IS NULL AND paid_at IS NULL))
);
ALTER TABLE toss_ledger_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE toss_ledger_charges ENABLE ROW LEVEL SECURITY;
