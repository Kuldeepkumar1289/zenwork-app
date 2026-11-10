# Zenwork Workspace API

Zenwork Workspace is a FastAPI backend for team operations. It provides user registration and authentication, organizational hierarchy, task delegation and blockers, attendance tracking, calendar events, team announcements, cross-department queries, and performance analytics.

## Features

- JWT bearer authentication and password hashing.
- User roles and manager/subordinate relationships.
- Task assignment, status updates, blocker reporting, and workload analytics.
- Attendance punch-in/punch-out and team attendance summaries.
- Calendar scheduling for sprint syncs, standups, and one-on-ones.
- Organization- or team-scoped announcements, including WebSocket delivery.
- Inter-department queries with priority and resolution status.
- Team performance scorecards and overdue-task email alerts.

## Technology

- Python with FastAPI and Pydantic
- SQLAlchemy ORM
- Relational database configured through `DATABASE_URL` (the requirements include the PostgreSQL `psycopg2` driver)
- JWT tokens via `python-jose`; password hashing via `bcrypt`
- Uvicorn ASGI server

## Project layout

```text
src/
  main.py                 FastAPI application, router registration, and DB table creation
  user/                   Registration, login, users, and organizational hierarchy
  tasks/                  Task and blocker routes, data models, and business logic
  attendance/             Attendance routes, models, and services
  calendar_events/        Calendar event routes, models, and controllers
  communications/         Notices, WebSocket route, and connection manager
  queries/                Inter-department query routes, models, and services
  analytics/              Performance scorecard routes and calculations
  notifications/          SMTP email alert delivery
  utils/                  Settings, database session, authentication dependencies
  worker/                 Overdue-task check used by the task API
requirements.txt          Python dependencies
```

## Requirements

- Python 3.10 or newer
- A database supported by SQLAlchemy and a matching database driver
- SMTP credentials only if real email delivery is needed

## Local setup

Run these commands from the project root:

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Create a `.env` file in the project root and configure the database and JWT settings:

```dotenv
DATABASE_URL=postgresql+psycopg2://USER:PASSWORD@HOST:5432/DATABASE
SECRET_KEY=replace-with-a-long-random-secret
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
```

For SMTP delivery, optionally add:

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASSWORD=your-smtp-password
FROM_EMAIL=no-reply@example.com
```

Keep `.env` and all real credentials private. The example database URL is illustrative; use values and a driver appropriate for your database.

Start the API:

```bash
uvicorn src.main:app --reload --host 127.0.0.1 --port 8000
```

When the app starts, `src.main` connects to the configured database and calls SQLAlchemy `create_all` for the imported models. The API does not currently run Alembic migrations during startup. The `alembic` package is a dependency, but this project does not include migration scripts or an Alembic configuration.

## API documentation and authentication

With the server running:

- Interactive Swagger UI: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`
- Health response: `GET http://127.0.0.1:8000/`

Most feature endpoints require an access token. Register a user, then log in at `POST /api/v1/users/login` using form-encoded OAuth2 fields (`username` is the user's email; `password` is the password). Use the returned `access_token` as a bearer token:

```http
Authorization: Bearer <access_token>
```

The configured token lifetime defaults to 1,440 minutes (24 hours). Request and response schemas are available in Swagger UI.

## HTTP endpoints

All routes below are prefixed with `/api/v1`, except the root health route.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` | API health message |
| `POST` | `/users/register` | Register a user |
| `POST` | `/users/login` | Authenticate and return a token |
| `GET` | `/users/me` | Get the authenticated user's profile |
| `GET` | `/users/org-tree` | Get the organization hierarchy |
| `POST` | `/tasks` | Create/delegate a task |
| `GET` | `/tasks` | List tasks visible to the user |
| `PATCH` | `/tasks/{task_id}/status` | Change task status |
| `GET` | `/tasks/analytics` | Task counts and hierarchy analytics |
| `POST` | `/tasks/{task_id}/block` | Report a task blocker |
| `PATCH` | `/tasks/blockers/{blocker_id}/resolve` | Resolve a blocker |
| `GET` | `/tasks/escalations` | List active blockers/escalations |
| `POST` | `/tasks/trigger-escalation-check` | Manually scan for overdue tasks and send alerts |
| `POST` | `/attendance/punch-in` | Start an attendance session |
| `POST` | `/attendance/punch-out` | End an attendance session |
| `GET` | `/attendance/me/today` | Get today's attendance status |
| `GET` | `/attendance/team` | Get team attendance; optional `target_date` query |
| `POST` | `/calendar` | Schedule a calendar event |
| `GET` | `/calendar/me` | List the user's calendar events |
| `POST` | `/communications` | Publish an announcement |
| `GET` | `/communications` | List announcements visible to the user |
| `POST` | `/queries` | Raise an inter-department query |
| `GET` | `/queries` | List relevant queries |
| `PATCH` | `/queries/{query_id}/resolve` | Resolve or reject a query |
| `GET` | `/analytics/scorecard` | Get a performance scorecard |

### Real-time announcements

Connect to `ws://127.0.0.1:8000/api/v1/communications/ws?token=<access_token>` using a valid access token in the `token` query parameter. New notices are pushed to connected users according to the notice scope. The current connection manager stores connections in process memory, so WebSocket broadcasts are limited to that running app process.

### Overdue-task alerts

The overdue-task scan is exposed as an authenticated manual endpoint; the repository does not configure a recurring scheduler to run it automatically. If SMTP credentials are absent, email alerts are printed to the application console as a development simulation.

## Configuration and deployment notes

- `DATABASE_URL`, `SECRET_KEY`, `ALGORITHM`, and `ACCESS_TOKEN_EXPIRE_MINUTES` configure the database and tokens. The token lifetime defaults to `1440` minutes.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `FROM_EMAIL` configure outgoing email.
- CORS currently allows all origins, methods, and headers. Restrict these settings to the trusted frontend origins before production deployment.
- Use a strong, unique `SECRET_KEY` outside local development and protect database/SMTP credentials.
- The app creates database tables on import; plan and apply explicit schema migrations when evolving a production database.

## Development

No test suite or test-runner configuration is currently included in the repository. The Swagger UI is the quickest way to inspect schemas and exercise endpoints against a configured local database.
