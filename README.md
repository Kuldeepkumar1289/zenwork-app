# Zenwork Workspace

Zenwork Workspace is a full-stack internal operations platform for employee management, task delegation, attendance, leave and WFH requests, scheduling, departmental queries, communications, and performance reporting.

The backend is FastAPI with SQLAlchemy, and the frontend is a static HTML/CSS/JavaScript application. The API is documented with Swagger UI and ReDoc.

## Features

- Organization registration and employee onboarding
- JWT authentication, password change/reset, and role-based access
- Manager/subordinate organization tree
- Task assignment, status workflows, blockers, escalations, attachments, and analytics
- Punch in/out, attendance history, leave, WFH, and attendance regularization
- Team availability and live attendance views
- Calendar and event management with RSVP responses
- Department-level queries with resolution status
- Notice boards, chat invitations, direct messages, and WebSocket notifications
- Voice, image, document, video, and archive uploads
- Performance scorecards and an admin workspace overview
- Scheduled overdue-task monitoring and email alerts

## Technology Stack

| Layer | Technology |
|---|---|
| API | FastAPI, Pydantic |
| Database | SQLAlchemy 2.0; MySQL-compatible by default |
| Authentication | OAuth2 bearer tokens, JWT, bcrypt |
| Background jobs | APScheduler |
| Realtime communication | FastAPI WebSockets |
| Frontend | HTML, Tailwind CDN, custom CSS, vanilla JavaScript |
| ASGI server | Uvicorn |

## Repository Layout

```text
.
├── src/
│   ├── main.py                 # Application setup and router registration
│   ├── admin/                  # Company-admin operations
│   ├── analytics/              # Performance scorecards
│   ├── attendance/             # Punches, leave, WFH, regularization
│   ├── calendar_events/        # Meeting and sprint scheduling
│   ├── communications/         # Notices, chat, uploads, WebSockets
│   ├── events/                 # Workspace events and RSVPs
│   ├── notifications/          # Email delivery
│   ├── queries/                # Inter-department queries
│   ├── tasks/                  # Tasks, blockers, and attachments
│   ├── user/                   # Users, roles, authentication, org tree
│   ├── utils/                  # Database, settings, security, dependencies
│   └── worker/                 # Scheduled overdue-task worker
├── frontend/
│   ├── index.html
│   ├── login.html
│   ├── css/
│   └── js/
├── requirements.txt
└── README.md
```

## Prerequisites

- Python 3.10 or newer
- MySQL or another SQL database supported by SQLAlchemy
- pip and virtual environment support
- SMTP credentials only if real email delivery is required

The database configuration is MySQL-oriented: startup also executes MySQL compatibility statements for selected schema columns.

## Quick Start

### 1. Create and activate a virtual environment

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

### 2. Configure the environment

```bash
cat > .env <<'EOF'
DATABASE_URL=mysql+pymysql://root:password@localhost:3306/zenwork_db
SECRET_KEY=replace-with-a-long-random-secret
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
EOF
```

Edit `.env` and replace the placeholder database URL and secret key.

Create the database first:

```sql
CREATE DATABASE zenwork_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Optional SMTP values:

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASSWORD=your-app-password
FROM_EMAIL=no-reply@zenwork.com
```

If SMTP credentials are omitted, the application simulates email dispatch by logging alert details to the server console.

### 3. Run the API

```bash
uvicorn src.main:app --reload --host 127.0.0.1 --port 8000
```

Available endpoints:

- Health: `http://127.0.0.1:8000/`
- Swagger: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`
- OpenAPI JSON: `http://127.0.0.1:8000/openapi.json`

All application routes are prefixed with `/api/v1`.

### 4. Serve the frontend

The frontend is static and can be served from any local HTTP server:

```bash
cd frontend
python -m http.server 3000
```

Open `http://127.0.0.1:3000/login.html`.

For a normal local run, change `API_BASE_URL` in [frontend/js/api.js](frontend/js/api.js) to:

```javascript
const API_BASE_URL = "http://127.0.0.1:8000/api/v1";
```

The repository currently points this value to the deployed Render backend.

## Authentication

The login route uses the OAuth2 password form:

```bash
curl -X POST "http://127.0.0.1:8000/api/v1/users/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin@example.com&password=your-password"
```

Send the returned token on protected requests:

```http
Authorization: Bearer <access_token>
```

Role tiers are `INTERN`, `MEMBER`, `TEAM_LEAD`, `MANAGER`, `HR`, and `ADMIN`. Hierarchy and company membership are also used to scope data.

WebSocket connections authenticate with the JWT query parameter:

```text
ws://127.0.0.1:8000/api/v1/communications/ws?token=<access_token>
```

## Uploads

Uploaded files are written to `uploads/` and exposed through:

- `/static/uploads/<filename>`
- `/uploads/<filename>`

Supported media and document types are validated by the media upload endpoint. Task attachments are stored in the same directory and are not separately restricted by a shared extension allowlist.

The current storage implementation is local filesystem storage. Use a persistent volume or replace it with object storage for production deployments.

## Background Processing

The APScheduler interval job runs when the application lifespan starts. It checks overdue `TODO` and `IN_PROGRESS` tasks every 15 minutes and sends an assignee warning plus a manager escalation email.

The same check can be triggered with:

```http
POST /api/v1/tasks/trigger-escalation-check
Authorization: Bearer <manager_or_admin_token>
```

## Data and Migrations

`Base.metadata.create_all(...)` creates tables that do not yet exist when the application starts. A few router modules also execute small startup compatibility statements.

The project does not provide an established migration workflow. Before changing models, create an Alembic revision so existing deployments can be upgraded safely.

## Production Notes

- Replace the default JWT secret and database credentials.
- Restrict CORS origins to the deployed frontend and trusted development origins.
- Enable HTTPS at the proxy or hosting platform.
- Mount persistent storage for `uploads/`.
- Configure SMTP and rotate app passwords/secrets.
- Use a production PostgreSQL/MySQL connection and connection limits appropriate for the database.
- Run migrations before application startup in an automated deployment.
- Add automated tests and CI coverage before production release.

