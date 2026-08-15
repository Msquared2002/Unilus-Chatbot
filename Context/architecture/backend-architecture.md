# UNILUS AI - Backend Architecture

**Status:** Architectural direction approved; detailed technology decisions
pending

## Direction

The system will use one Node.js backend serving the website, student portal,
e-learning client, and future PWA. The initial deployment should be a modular
monolith. Logical service boundaries must be established before considering
physical service separation.

## Layering

```text
API and transport layer
        |
Application and use-case layer
        |
Domain layer
        |
Repository interfaces
        |
Infrastructure adapters
```

The AI must never access Google Sheets, files, vector stores, or university
systems directly. It requests information through backend application
services.

## Logical service boundaries

- Public knowledge and content
- Conversations and chat sessions
- Student services
- Academic data
- Identity and session context
- Peer tutors
- Notifications and reminders
- Knowledge ingestion and publishing
- External university integrations

These are modules, not separate deployments, until scale or operational needs
justify otherwise.

## Authentication philosophy

- Guest users receive public information only.
- The university authentication system remains the identity source of truth.
- UNILUS AI must never collect or store university passwords.
- Future authenticated requests receive identity/session claims from the
  university integration.
- Server-side authorization is required for student-specific data.
- Session expiry follows university policy.

## Knowledge and RAG boundary

```text
Approved sources
  -> ingestion and normalization
  -> chunking and metadata
  -> embeddings and vector index
  -> retrieval
  -> answer generation
  -> citations, confidence, and escalation
```

The handbook, official web content, approved documents, and future Google
Sheets records must carry source metadata, version information, and update
timestamps. The Academic Office is the authority for the current handbook.

The exact LLM, embedding model, vector database, ingestion scheduler, and
evaluation method remain pending decisions.

## Data layer

The first data direction is Google Sheets used as structured relational tables
with stable IDs and relationships. Repository interfaces must hide the source
from the domain and application layers.

Future migration to Supabase/PostgreSQL or another database must replace an
infrastructure adapter rather than require frontend or domain rewrites.

## Reliability

Public knowledge must continue where possible if student systems are
unavailable. Student-specific services must fail independently with clear
user-facing messaging. Timeouts, retries, logging, health checks, and audit
requirements remain pending detailed design.
