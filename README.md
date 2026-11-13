# Zenwork Workspace Project Documentation

## 1. Project Overview
Zenwork Workspace is an internal team operations and productivity platform built with FastAPI. It helps organizations manage employees, tasks, attendance, calendar events, departmental queries, and internal communication workflows in one place.

The application is designed for modern workplace operations, where managers can assign tasks, track attendance, monitor performance, and handle ongoing work from a single dashboard.

## 2. Business Goal
The platform aims to improve operational visibility for teams by centralizing:
- Employee profiles and hierarchy
- Task allocation and tracking
- Daily attendance and work hours
- Organizational events and scheduling
- Department-level queries and escalations
- Team analytics and workload visibility

## 3. Core Features
### User and Organization Management
- User registration and login
- Role-based access: ADMIN, MANAGER, MEMBER
- Manager-subordinate hierarchy
- Profile retrieval and org tree visualization

### Task Management
- Create, assign, and update tasks
- Task priorities and statuses
- Blocker reporting and resolution
- Deadline tracking and escalations
- Task analytics by status and hierarchy

### Attendance Tracking
- Punch-in and punch-out flow
- Daily attendance records
- Total work-hour calculation
- Team attendance summaries

### Calendar and Scheduling
- Event creation with title, time range, and attendees
- Optional meeting links
- User-specific event retrieval

### Inter-Department Queries
- Raise support or operational queries
- Target department assignment
- Priority and resolution tracking
- Status updates: OPEN, IN_REVIEW, RESOLVED, REJECTED

### Performance and Analytics
- Hierarchy-scoped scorecards
- Task, attendance, and blocker metrics
- Member workload analysis and burnout risk flagging

### Communication and Uploads
- Media uploads for audio, docs, and images
- Task attachments and file storage
- Chat invite/message workflow design for member-to-member communication

## 4. Project Structure
```text
zenwork_app/
├── src/
│   ├── main.py
│   ├── user/
│   ├── tasks/
│   ├── attendance/
│   ├── calendar_events/
│   ├── queries/
│   ├── analytics/
│   ├── communications/
│   ├── notifications/
│   ├── utils/
│   └── worker/
├── frontend/
│   ├── index.html
│   ├── login.html
│   ├── css/
│   └── js/
├── tests/
├── uploads/
├── .env
├── requirements.txt
├── README.md
├── PROJECT_DOCUMENTATION.md
└── venv/
```

## 5. Technology Stack
- Python 3.10+
- FastAPI
- SQLAlchemy ORM
- PostgreSQL-ready database support
- Pydantic for validation
- JWT-based authentication
- Passlib + bcrypt for password security
- Uvicorn for ASGI server
- APScheduler for periodic tasks
- HTML, CSS, and JavaScript for frontend

## 6. Authentication and Authorization
The app uses OAuth2 bearer token authentication for protected routes. Users register with personal credentials and login with their email and password. The returned JWT is sent in the Authorization header for secure access.

Authorization is mainly based on:
- User role tier
- Manager/subordinate relationships
- Task ownership and assignment
- Department scope

## 7. Database and Data Model
The application stores core entities such as:
- Users
- Tasks
- Attendance records
- Events
- Queries
- Blockers
- Communication invites and messages
- Task attachments and uploads

A SQLAlchemy database layer is used to define and manage these models, with configuration driven by the DATABASE_URL environment variable.

## 8. Frontend Overview
The frontend is built as a static web app under `frontend/` and includes:
- Login screen
- Dashboard
- Attendance widgets
- Task panels and filters
- Calendar view
- Analytics widgets
- Sidebar navigation and UI sections

JavaScript modules are organized to fetch the backend API and update the UI without page refresh.

## 9. Environment Configuration
The project reads configuration values from environment variables and `.env`.

Required configuration includes:
- DATABASE_URL
- SECRET_KEY
- ALGORITHM
- ACCESS_TOKEN_EXPIRE_MINUTES

Optional SMTP settings may also be configured for email notifications:
- SMTP_HOST
- SMTP_PORT
- SMTP_USER
- SMTP_PASSWORD
- FROM_EMAIL

## 10. Run Instructions
### Install dependencies
```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

### Start the backend
```bash
uvicorn src.main:app --reload --host 127.0.0.1 --port 8000
```

### Access points
- Swagger UI: http://127.0.0.1:8000/docs
- ReDoc: http://127.0.0.1:8000/redoc
- Health endpoint: http://127.0.0.1:8000/

## 11. API Flow Summary
Typical flow:
1. Register user
2. Log in to receive token
3. Access protected endpoints with bearer token
4. Create tasks or attendance records
5. View analytics and team activity
6. Resolve blockers or department queries

## 12. Current Project Status and Limitations
The project is functional in structure and includes a broad set of features, but some areas still require attention:
- The communications router import path is currently broken and prevents full registration of chat routes.
- Some uploads are stored locally but require static-file hosting for direct URL serving.
- CORS configuration is currently broad and should be restricted before production deployment.
- Additional validation and production hardening are recommended before live use.

## 13. Summary
Zenwork Workspace is a practical internal operations platform that combines team user management, task tracking, attendance, scheduling, and analytics into one system. It is a strong foundation for an enterprise productivity app and is suitable for further extension into production-grade workflows.
