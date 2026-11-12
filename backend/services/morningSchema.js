const definitions=[
'CREATE TABLE IF NOT EXISTS brief_preferences(id TEXT PRIMARY KEY,owner TEXT NOT NULL UNIQUE,automatic INTEGER NOT NULL,updated_at TEXT NOT NULL)',
'CREATE TABLE IF NOT EXISTS brief_deliveries(id TEXT PRIMARY KEY,owner TEXT NOT NULL,local_date TEXT NOT NULL,claimed_at TEXT NOT NULL,UNIQUE(owner,local_date))',
`CREATE TABLE IF NOT EXISTS personal_reminders(id TEXT PRIMARY KEY,owner TEXT NOT NULL,title TEXT NOT NULL,due_at TEXT NOT NULL,status TEXT NOT NULL,revision INTEGER NOT NULL,operation_id TEXT NOT NULL,creation_fingerprint TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(owner,operation_id),CHECK(status IN ('active','completed','cancelled')))`,
'CREATE INDEX IF NOT EXISTS reminder_owner_due ON personal_reminders(owner,status,due_at)',
'CREATE TABLE IF NOT EXISTS reminder_events(id TEXT PRIMARY KEY,reminder_id TEXT NOT NULL REFERENCES personal_reminders(id),owner TEXT NOT NULL,revision INTEGER NOT NULL,due_at TEXT NOT NULL,created_at TEXT NOT NULL,read_at TEXT,UNIQUE(reminder_id,revision))',
'CREATE INDEX IF NOT EXISTS reminder_event_owner ON reminder_events(owner,created_at)'];module.exports={definitions};
