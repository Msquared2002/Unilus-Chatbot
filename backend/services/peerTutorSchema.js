const definitions=[
"CREATE TABLE IF NOT EXISTS peer_tutor_profiles(id TEXT PRIMARY KEY,owner TEXT NOT NULL UNIQUE,display_name TEXT NOT NULL,programme TEXT NOT NULL,academic_level TEXT NOT NULL,introduction TEXT NOT NULL,visible INTEGER NOT NULL,available INTEGER NOT NULL,profile_version TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)",
"CREATE TABLE IF NOT EXISTS peer_tutor_courses(id TEXT PRIMARY KEY,tutor_id TEXT NOT NULL REFERENCES peer_tutor_profiles(id),course_code TEXT NOT NULL,UNIQUE(tutor_id,course_code))",
"CREATE TABLE IF NOT EXISTS peer_tutor_requests(id TEXT PRIMARY KEY,requester TEXT NOT NULL,tutor_id TEXT NOT NULL REFERENCES peer_tutor_profiles(id),course_code TEXT NOT NULL,requester_name TEXT NOT NULL,message TEXT NOT NULL,status TEXT NOT NULL,operation_id TEXT NOT NULL,created_at TEXT NOT NULL,expires_at TEXT NOT NULL,updated_at TEXT NOT NULL,contact_method TEXT,contact_value TEXT,consented_at TEXT,revoked_at TEXT,UNIQUE(requester,operation_id),CHECK(status IN ('pending','accepted','declined','cancelled','expired')))",
"CREATE UNIQUE INDEX IF NOT EXISTS peer_one_pending ON peer_tutor_requests(requester,course_code) WHERE status='pending'",
"CREATE INDEX IF NOT EXISTS peer_course_search ON peer_tutor_courses(course_code,tutor_id)",
"CREATE INDEX IF NOT EXISTS peer_requests_tutor ON peer_tutor_requests(tutor_id,status)",
"CREATE TABLE IF NOT EXISTS peer_tutor_events(id TEXT PRIMARY KEY,request_id TEXT NOT NULL REFERENCES peer_tutor_requests(id),recipient TEXT NOT NULL,kind TEXT NOT NULL,created_at TEXT NOT NULL,read_at TEXT,UNIQUE(request_id,recipient,kind))",
"CREATE INDEX IF NOT EXISTS peer_event_recipient ON peer_tutor_events(recipient,created_at)"
];
module.exports={definitions};
