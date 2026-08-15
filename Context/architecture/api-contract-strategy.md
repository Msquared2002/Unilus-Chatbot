# UNILUS AI - API Contract Strategy

**Status:** Proposed; detailed contract approval pending

## Principle

The dummy frontend must be built against stable domain contracts even though
the backend is deferred. Mock repositories and future HTTP clients must expose
the same logical operations and response shapes.

## Contract ownership

Contracts belong in a top-level `contracts/` directory and are independent of
any one frontend client. The final format and version must be approved before
backend implementation. OpenAPI is the recommended format for HTTP contracts.

## Resource groups

- Public content
- Programmes
- Fees
- FAQs
- Announcements
- Timetables
- Courses
- Student profile
- Conversations
- Peer tutors

## Required response metadata

Where applicable, responses should include:

- stable resource IDs;
- resource type;
- last-updated timestamp;
- demo/live indicator;
- source or citation metadata;
- availability status;
- pagination metadata for collections.

## Error model

The contract should standardize validation errors, authentication errors,
authorization errors, unavailable services, not-found results, rate limits,
and unexpected failures. Frontends must render meaningful states instead of
assuming every request succeeds.

## Chat response requirements

Chat responses should be capable of representing:

- answer text;
- conversation/message IDs;
- source citations;
- confidence or verification state;
- escalation recommendation;
- service availability;
- demo/live status.

## Frontend implementation rule

The browser must call repository interfaces. Only the HTTP adapter may know
endpoint paths, transport details, authentication headers, or retry policies.
This lets local fixtures be replaced without rewriting pages or components.
