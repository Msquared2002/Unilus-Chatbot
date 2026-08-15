# UNILUS AI -- Architecture & Planning Snapshot

## Vision

Build **UNILUS AI**, an AI-powered **Student Digital Companion** whose
first responsibility is acting as the university's **Digital Front
Desk**.

### Digital Front Desk

-   Reduce repetitive enquiries to the Academic Office.
-   Answer common questions (registration, fees, calendars, exams,
    procedures, contacts).
-   24/7 access to official information.

### Student Digital Companion

-   AI study support.
-   Personalized student information after authentication.
-   Verified peer tutor discovery.
-   Campus guidance and ongoing academic assistance.

## Problem Statement

University information is fragmented across websites, documents, the
student portal and e-learning. Students repeatedly visit or call the
Academic Office for routine enquiries, increasing workload and queues.

## Objectives

1.  Reduce repetitive physical and phone enquiries.
2.  Provide 24/7 conversational access to official information.
3.  Centralize official knowledge.
4.  Personalize services for authenticated students.
5.  Connect students with verified peer tutors.
6.  Offer AI-assisted study support.

## Architecture

One backend (Node.js).

Clients: - Public website (Guest Mode) - Student Portal (Student Mode) -
Progressive Web App (PWA)

Knowledge sources: - Google Sheets (initial) - RAG over handbook, public
website, official documents - Future university APIs

## Approved Frontend Stack

The dummy UNILUS environment must be built with:

- HTML5
- CSS3
- Vanilla JavaScript (ES6+)

This is a locked architectural decision for the frontend unless explicitly
changed. The absence of a frontend framework does not remove the requirement
for modularity, separation of concerns, reusable UI patterns, repository
interfaces, API-first design, responsive behaviour, accessibility, or
maintainability.

The frontend must be structured as a real client of the future Node.js
backend. During the dummy phase, repository and service interfaces use local
demo adapters. Later, those adapters can be replaced by HTTP API adapters
without rewriting page markup or presentation logic.

React, TypeScript, Vite, Supabase, a specific LLM provider, a specific vector
database, and a specific hosting platform are not approved by this snapshot.
They remain pending architectural decisions unless explicitly approved.

## Authentication

Guest Mode: - Public information only.

Student Mode: - Uses university authentication if integrated. - Chatbot
never stores portal passwords. - Receives authenticated
identity/session. - Session expiry follows university policy.

## PWA

Preferred over native apps initially. Reasons: - One codebase. -
Installable. - Automatic updates. - Home-screen experience. - Shared
backend.

Offline: - Cache public knowledge. - Personal data only when
authenticated and available.

## Graceful Degradation

If portal unavailable: - Public knowledge still works. -
Student-specific services unavailable with clear messaging.

## Peer Tutors

-   Verified tutors.
-   Visibility toggle.
-   Busy/Hidden states.
-   AI recommends only visible and accepting tutors.

## Google Sheets Plan

Initial tabs: - Lecturers - Office Hours Future: - Courses - Lecturer
Courses - Academic Calendar - Announcements - Buildings - FAQ - Peer
Tutors

Treat sheets as relational tables with IDs.

## Lecturer Pitch

Project solves enquiry management while extending into continuous
student support.

Key phrase: "UNILUS AI is more than a chatbot. It is a Digital Front
Desk and Student Digital Companion."

## Dummy Environment

Create replica interfaces for: - Main UNILUS website - Student Portal -
E-learning

Use demo data only, with architecture ready for future integration.

## Suggested Project Folder

context/ - architecture_snapshot.md - website/ - portal/ - elearning/ -
handbook/ - screenshots/ - branding/ - notes/
