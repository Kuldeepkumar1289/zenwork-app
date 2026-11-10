# Zenwork Workspace API

Zenwork Workspace is a FastAPI service for team operations. It combines user accounts and reporting lines with task delegation, blockers, attendance, calendar events, cross-department queries, performance metrics, media uploads, and a member-to-member chat-request workflow.

This document describes the current source tree. Some functionality is defined in code but is not currently reachable; see [Current limitations](#current-limitations) before starting the service.

## Contents

- [Capabilities](#capabilities)
- [Technology and layout](#technology-and-layout)
- [Requirements and local setup](#requirements-and-local-setup)
- [Configuration](#configuration)
- [Run the API](#run-the-api)
- [Authentication](#authentication)
- [HTTP API reference](#http-api-reference)
- [Common workflows](#common-workflows)
- [Background overdue-task checks](#background-overdue-task-checks)
- [Database and schema lifecycle](#database-and-schema-lifecycle)
- [Testing](#testing)
- [Deployment and operational notes](#deployment-and-operational-notes)
- [Current limitations](#current-limitations)

## Capabilities

- **Accounts and organization:** registration, password-based login, profile lookup, role tiers (`ADMIN`, `MANAGER`, `MEMBER`), and a manager/subordinate hierarchy.
- **Task tracking:** task creation and delegation, status changes, blocker reporting and resolution, hierarchy-scoped task lists, and task status counts.
- **Attendance:** daily punch-in and punch-out records, duration calculation, half-day classification, and a team attendance report.
- **Calendar:** meetings with event types, optional meeting links, and multiple attendees.
- **Inter-department queries:** requests targeted to a department, optional task/user assignment, priorities, and resolution notes.
- **Performance analytics:** hierarchy-scoped task, attendance, blocker, and per-member workload metrics.
- **Member chat workflow:** request, accept/decline/ignore, direct messages, and conversation-history functions are present in the communications module. The router is currently broken, so these routes are not available until the limitation described below is fixed.
- **Uploads and notifications:** authenticated media upload and task attachments write files to a local `uploads/` directory; overdue-task checks can send email alerts when SMTP credentials are configured.

## Technology and layout

- Python, FastAPI, and Pydantic
- SQLAlchemy ORM
- Database URL supplied through `DATABASE_URL`; the requirements include `psycopg2-binary` for PostgreSQL. Install the matching DBAPI driver for any other SQLAlchemy database dialect you choose.
- JWT access tokens via `python-jose`; passwords are hashed with `bcrypt`
- Uvicorn ASGI server
- APScheduler for periodic overdue-task scans

```text
src/
  main.py                    FastAPI app, router registration, DB table creation, lifespan
  user/                      Registration, login, profiles, organization hierarchy
  tasks/                     Tasks, task attachments, status and blocker workflows
  attendance/                Punch-in/out and team attendance
  calendar_events/           Calendar event routes, schemas, models, and controller
  communications/            Chat request/message logic and media upload route
  queries/                    Inter-department query routes, schemas, models, and service
  analytics/                  Performance scorecard routes and calculations
  notifications/              SMTP email alert delivery
  utils/                      Settings, SQLAlchemy session, and auth dependencies
  worker/                     Overdue-task check and APScheduler integration
tests/
  test_backend_core.py        Health, attendance, and task-delegation tests
uploads/                      Local upload destination
requirements.txt              Python dependencies
```

## Requirements and local setup

- Python 3.10 or newer
- A database server and the SQLAlchemy driver matching its URL scheme
- SMTP access only if real overdue-task email delivery is needed

From the repository root, create and activate a virtual environment and install the listed dependencies:

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Create a `.env` file in the project root. Provide a database URL appropriate for your database and a strong, unique signing key:

```dotenv
DATABASE_URL=your-database-url
SECRET_KEY=replace-with-a-long-random-secret
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
```

For example, the URL format depends on the installed database driver; do not copy credentials into source control. The `DATABASE_URL` value must be usable by SQLAlchemy and its configured DBAPI driver.

To enable SMTP delivery, configure:

```dotenv
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASSWORD=your-smtp-password
FROM_EMAIL=no-reply@example.com
```

Keep `.env` and all production credentials private. The SMTP settings are read by the notification module from the process environment.

## Configuration

| Variable | Purpose | Default / behavior |
|---|---|---|
| `DATABASE_URL` | SQLAlchemy connection string | Read from the process environment or `.env`; configure a reachable database and matching driver. |
| `SECRET_KEY` | Signs and verifies access tokens | Must be replaced with a strong, private value outside local development. |
| `ALGORITHM` | JWT signing algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token lifetime in minutes | `1440` (24 hours) |
| `SMTP_HOST` | SMTP server | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP server port | `587` |
| `SMTP_USER` | SMTP account | Empty by default; email is simulated in the console when credentials are absent. |
| `SMTP_PASSWORD` | SMTP password | Empty by default; email is simulated in the console when credentials are absent. |
| `FROM_EMAIL` | Sender address | `no-reply@zenwork.com` |

The application currently allows all CORS origins, methods, and headers. Tighten this configuration to the trusted frontend origins before deployment.

## Run the API

Start the application from the repository root:

```bash
uvicorn src.main:app --reload --host 127.0.0.1 --port 8000
```

Once running:

- Swagger UI: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`
- Health endpoint: `GET http://127.0.0.1:8000/`

The OpenAPI pages show the request and response models for routes that are successfully registered. The current communications-router defect prevents application import, so the server and its OpenAPI pages will not start until that defect is corrected.

## Authentication

Except for the health check and the organization-tree route, feature routes use OAuth2 bearer authentication. Register a user, then submit a form-encoded login request to `POST /api/v1/users/login`. The OAuth2 field named `username` must contain the account email; the other field is `password`.

Example login:

```bash
curl -X POST http://127.0.0.1:8000/api/v1/users/login \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'username=person@example.com' \
  --data-urlencode 'password=your-password'
```

The response contains `access_token`, `token_type` (`bearer`), and the user profile. Send the token on protected HTTP requests:

```http
Authorization: Bearer <access_token>
```

The token's `sub` claim is the user's email. Authorization for task and attendance data is generally based on the user's reporting hierarchy; some routes also apply role-specific behavior for admins. `GET /api/v1/users/org-tree` currently has no authentication dependency.

## HTTP API reference

All paths below are prefixed with `/api/v1`, except `GET /`. Unless noted, feature endpoints require a bearer token. Request fields and enum values are validated by the Pydantic models and are also intended to appear in the generated OpenAPI schema.

### Health and users

| Method | Path | Purpose | Request / notes |
|---|---|---|---|
| `GET` | `/` | Health response | Returns `{"message":"Zenwork Workspace API is running!"}`. |
| `POST` | `/users/register` | Create an account | JSON fields: `full_name`, `email`, `password`; optional `role_tier` (`ADMIN`, `MANAGER`, `MEMBER`, default `MEMBER`), `designation` (default `Team Member`), and `manager_id`. Returns `201`. |
| `POST` | `/users/login` | Authenticate | Form fields `username` (email) and `password`; returns a bearer token and user profile. |
| `GET` | `/users/me` | Return the authenticated user's profile | Bearer token required. |
| `GET` | `/users/org-tree` | Return the organization hierarchy | Currently unauthenticated; starts from users without a manager and includes their descendants. |

### Tasks and blockers

Task statuses are `TODO`, `IN_PROGRESS`, `BLOCKED`, and `COMPLETED`. Priorities are `LOW`, `MEDIUM`, `HIGH`, and `CRITICAL`.

| Method | Path | Purpose | Request / notes |
|---|---|---|---|
| `POST` | `/tasks` | Create a task and optionally assign it | JSON fields include `title`; optional `description`, `priority` (default `MEDIUM`), `due_date`, `assigned_to_id`, `attachment_url`, and `attachment_name`. Returns `201`. Non-admins can delegate only within their reporting line, or assign to themselves. |
| `GET` | `/tasks` | List tasks visible to the caller | Admins see all tasks; other users see tasks assigned within their reporting hierarchy and tasks they created. |
| `PATCH` | `/tasks/{task_id}/status` | Change task status | JSON body: `{"status":"IN_PROGRESS"}` (use one of the task statuses). |
| `GET` | `/tasks/analytics` | Return task counts | Includes total, per-status counts, and the caller's number of direct subordinates. |
| `POST` | `/tasks/{task_id}/block` | Report a blocker | JSON body: `{"reason":"..."}`. Only the task assignee or creator can report it; the task becomes `BLOCKED`. Returns `201`. |
| `PATCH` | `/tasks/blockers/{blocker_id}/resolve` | Resolve a blocker | No request body. Marks the blocker resolved and changes its task to `IN_PROGRESS`. |
| `GET` | `/tasks/escalations` | List unresolved blocker escalations | Admins see all unresolved blockers; others see blockers for tasks assigned to their subordinates. |
| `POST` | `/tasks/trigger-escalation-check` | Run an overdue-task scan immediately | Authenticated endpoint; returns a count of overdue tasks found and attempts to send notifications. |
| `POST` | `/tasks/{task_id}/attachment` | Save a file against a task | Multipart form field: `file`. Allowed to the assignee, creator, a manager in the assignee's reporting line, or an admin. Saves to local disk and updates the task attachment fields. |

### Attendance

| Method | Path | Purpose | Request / notes |
|---|---|---|---|
| `POST` | `/attendance/punch-in` | Start today's attendance record | Optional JSON `notes`; returns `201`. A second punch-in on the same day is rejected. |
| `POST` | `/attendance/punch-out` | End the active attendance record | Optional JSON `notes`; calculates `total_hours`. Less than 4.5 hours is classified as `HALF_DAY`; otherwise status is `PRESENT`. |
| `GET` | `/attendance/me/today` | Read today's attendance record | Returns the record or `null` when no record exists. |
| `GET` | `/attendance/team` | Read a team attendance summary | Optional `target_date` query parameter in `YYYY-MM-DD` form. Admins see all records for that date; other users see records for their subordinate IDs. |

Attendance timestamps are based on UTC in the service code. The team report's `total_checked_in` is the number of records returned for the requested date.

### Calendar

| Method | Path | Purpose | Request / notes |
|---|---|---|---|
| `POST` | `/calendar` | Schedule an event | Required: `title`, `start_time`, `end_time`. Optional: `description`, `event_type` (`SPRINT_SYNC`, `STANDUP`, `ONE_ON_ONE`, `GENERAL`), `meeting_link`, and `attendee_ids`. Returns `201`; `start_time` must precede `end_time`. The organizer is added as an attendee. Non-admins can invite themselves, their direct manager, and users in their subordinate hierarchy. |
| `GET` | `/calendar/me` | List the authenticated user's events | Returns events the user organized or attends, ordered by start time. |

### Inter-department queries

Query priorities are `LOW`, `MEDIUM`, `HIGH`, and `URGENT`. Query statuses are `OPEN`, `IN_REVIEW`, `RESOLVED`, and `REJECTED`.

| Method | Path | Purpose | Request / notes |
|---|---|---|---|
| `POST` | `/queries` | Raise a query | Required: `title`, `description`, `target_department`. Optional: `priority` (default `MEDIUM`), `task_id`, and `assigned_to_id`. Returns `201`. |
| `GET` | `/queries` | List queries visible to the caller | Admins see all; other users see queries they raised or that are assigned to them. |
| `PATCH` | `/queries/{query_id}/resolve` | Resolve or reject a query | Requires `resolution_notes`; `status` defaults to `RESOLVED`. The service records the supplied status and a resolution timestamp. |

### Analytics

| Method | Path | Purpose | Response notes |
|---|---|---|---|
| `GET` | `/analytics/scorecard` | Return a hierarchy-scoped scorecard | Includes assigned/completed/overdue task counts, `on_time_delivery_rate`, attendance hours, active blockers, and per-member active/blocked workload. The current calculation of `on_time_delivery_rate` is completed tasks divided by all assigned tasks; it does not compare completion times with due dates. The workload `burnout_risk` flag is true at four or more active (`TODO` or `IN_PROGRESS`) tasks. |

### Media uploads

| Method | Path | Purpose | Request / notes |
|---|---|---|---|
| `POST` | `/media/upload-voice` | Save a media or document file | Multipart form field: `file`. Accepted extensions: `.mp3`, `.wav`, `.webm`, `.ogg`, `.m4a`, `.pdf`, `.png`, `.jpg`. Returns a filename, a `/static/uploads/...` URL, and the uploader's name. |

Uploads are stored locally under `uploads/`. The current app does not mount this directory as a static-files route, so the returned URL is not served by this FastAPI app without additional static-file or reverse-proxy configuration. Task attachments do not apply the media endpoint's extension allowlist.

### Member-to-member chat (not currently available)

The communications source defines the following router handlers and payloads:

| Router-relative method | Path | Purpose | Request / notes |
|---|---|---|---|
| `POST` | `/chat/invite` | Send a chat invitation | JSON: `receiver_id`; optional `initial_message`. |
| `GET` | `/chat/invites/pending` | List incoming pending invitations | No request body. |
| `PATCH` | `/chat/invites/{request_id}/respond` | Accept, decline, or ignore an invitation | JSON: `{"status":"ACCEPTED"}`; valid values are `ACCEPTED`, `DECLINED`, `IGNORED`. |
| `POST` | `/chat/messages` | Send a direct message | JSON: `receiver_id`, optional `message_text`, optional `attachment_url`. The connection must have an accepted invitation. |
| `GET` | `/chat/messages/{partner_id}` | Get conversation history | Returns messages between the caller and the other user, ordered oldest first. |

The expected communications namespace is `/api/v1/communications`, but the route definitions are currently unusable: `src/communications/router.py` decorates an undefined `comm_router`, while `src/main.py` imports `communication_router`, which that module does not export. As a result, these handlers cannot currently be registered and the application cannot import successfully.

## Common workflows

### Register and authenticate

1. Send `POST /api/v1/users/register` with a name, valid email, password, and optional role/designation/manager.
2. Send `POST /api/v1/users/login` with form-encoded `username` (the email) and `password`.
3. Use the returned `access_token` as a bearer token for protected routes.

The registration endpoint currently accepts a `role_tier` in the request model; do not expose unrestricted account registration to untrusted clients in a production deployment without enforcing role-assignment policy.

### Delegate and update a task

1. Create a task with `POST /api/v1/tasks`; set `assigned_to_id` to a user in the caller's reporting line (or the caller's own ID).
2. Read visible tasks with `GET /api/v1/tasks`.
3. Update progress with `PATCH /api/v1/tasks/{task_id}/status`.
4. If blocked, report the reason with `POST /api/v1/tasks/{task_id}/block`; resolve it with `PATCH /api/v1/tasks/blockers/{blocker_id}/resolve`.

### Record attendance

1. Start a record with `POST /api/v1/attendance/punch-in`.
2. End it with `POST /api/v1/attendance/punch-out`.
3. Check the caller's status at `GET /api/v1/attendance/me/today`, or request a team report with `GET /api/v1/attendance/team`.

## Background overdue-task checks

The application starts an APScheduler job during FastAPI lifespan startup and shuts it down at lifespan termination. The job runs every 15 minutes. It finds tasks in `TODO` or `IN_PROGRESS` whose due date is earlier than the current UTC time, alerts the assignee, and sends an escalation to that assignee's manager when available. The authenticated `POST /api/v1/tasks/trigger-escalation-check` route runs the same check manually.

When `SMTP_USER` or `SMTP_PASSWORD` is empty, the email service prints a delivery simulation to the application console. If SMTP is configured but sending fails, the service logs the failure. No separate worker process or external scheduler is required by the current implementation.

## Database and schema lifecycle

SQLAlchemy models are registered with `Base.metadata`, and `src/main.py` calls `Base.metadata.create_all()` during module import. This creates missing tables but does not migrate existing tables when model columns or constraints change. Although Alembic is listed as a dependency, the repository currently has no migration configuration or revision scripts. Use a managed migration process before evolving a production schema.

The database engine is configured with connection pre-ping, a pool size of 10, a 3,600-second recycle interval, and up to 20 overflow connections. Database connections must be available to the process during application import/startup.

## Testing

The test suite uses an in-memory SQLite database and includes tests for the health endpoint, attendance punch-in/out behavior, and task delegation permissions. Run it with:

```bash
python -m pytest -q
```

At the time this document was updated, test collection fails before any tests run because importing `src.main` imports the broken communications router (`comm_router` is undefined). Fix the router registration described above before treating test results as meaningful.

## Deployment and operational notes

- Replace the development JWT secret with a strong, unique secret and protect it, database credentials, and SMTP credentials.
- Restrict CORS origins, methods, and headers to the frontend's actual needs.
- Define and apply database migrations; `create_all()` is not a schema migration strategy.
- Persist uploaded files on durable storage and configure a static/media serving layer; the current local upload directory is not mounted by the application.
- Apply an explicit policy for who may register as an admin or manager.
- The periodic scheduler is started in each application process. If deploying multiple API workers, account for the fact that each process will start its own scheduler.
- Provide HTTPS and secure secret management in production; the local Uvicorn command is for development.

## Current limitations

1. **Communications import/registration is broken.** `src/communications/router.py` references `comm_router` without defining it and does not export the `communication_router` imported by `src/main.py`. This prevents importing the FastAPI application, so Uvicorn startup, OpenAPI access, and pytest collection currently fail.
2. **Announcement and WebSocket routes are not currently registered.** The current communications router contains chat request/message handlers, but no announcement routes or WebSocket endpoint. The old announcement/WebSocket behavior should not be assumed to be available.
3. **Uploaded media is not served by the app.** Upload handlers return `/static/uploads/...` paths, but `src/main.py` does not mount a static directory.
4. **No schema migration scripts are present.** Existing deployments will not be upgraded by `create_all()`.
