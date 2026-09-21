CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workspaces (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id BIGINT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS schedules (
  id BIGSERIAL PRIMARY KEY,
  workspace_id BIGINT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  day INTEGER NOT NULL CHECK (day BETWEEN 1 AND 31),
  time TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  tone TEXT NOT NULL CHECK (tone IN ('coral', 'blue', 'yellow')),
  created_by BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS todos (
  id BIGSERIAL PRIMARY KEY,
  workspace_id BIGINT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  meta TEXT NOT NULL DEFAULT '待安排',
  tone TEXT NOT NULL DEFAULT 'blue' CHECK (tone IN ('coral', 'blue', 'yellow')),
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_by BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS schedules_workspace_date_idx ON schedules(workspace_id, year, month, day);
CREATE INDEX IF NOT EXISTS todos_workspace_idx ON todos(workspace_id, completed);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'worklife') THEN
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO worklife;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO worklife;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO worklife;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO worklife;
  END IF;
END $$;
