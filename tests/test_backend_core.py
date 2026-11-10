# tests/test_backend_core.py
from datetime import datetime, timezone
from src.user.models import User, RoleTier
from src.utils.security import hash_password, create_access_token

def test_health_check(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Zenwork Workspace API is running!"}

def test_attendance_and_math_integrity(client, db):
    # 1. Create a test employee
    user = User(
        full_name="Test Dev",
        email="testdev@zenwork.com",
        hashed_password=hash_password("Pass123!"),
        role_tier=RoleTier.MEMBER
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(data={"sub": user.email})
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Punch In (Status code 201 Created)
    punch_in_res = client.post("/api/v1/attendance/punch-in", json={"notes": "Starting shift"}, headers=headers)
    assert punch_in_res.status_code == 201
    data = punch_in_res.json()
    assert data["status"] == "PRESENT"
    assert data["punch_out"] is None

    # 3. Duplicate Punch In check (Must Fail with 400 Bad Request)
    dup_res = client.post("/api/v1/attendance/punch-in", json={"notes": "Duplicate"}, headers=headers)
    assert dup_res.status_code == 400

    # 4. Punch Out (Status code 200 OK)
    punch_out_res = client.post("/api/v1/attendance/punch-out", json={"notes": "End day"}, headers=headers)
    assert punch_out_res.status_code == 200
    out_data = punch_out_res.json()
    assert out_data["punch_out"] is not None
    assert out_data["status"] == "HALF_DAY"

def test_unauthorized_delegation_security(client, db):
    mgr = User(full_name="Manager A", email="mgr_a@zenwork.com", hashed_password=hash_password("P@ss1"), role_tier=RoleTier.MANAGER)
    other_member = User(full_name="Member B", email="mem_b@zenwork.com", hashed_password=hash_password("P@ss2"), role_tier=RoleTier.MEMBER)
    db.add_all([mgr, other_member])
    db.commit()
    db.refresh(mgr)
    db.refresh(other_member)

    mgr_token = create_access_token(data={"sub": mgr.email})
    headers = {"Authorization": f"Bearer {mgr_token}"}

    task_payload = {
        "title": "Unauthorized Task Delegation",
        "description": "Testing boundary check",
        "priority": "HIGH",
        "assigned_to_id": other_member.id
    }
    res = client.post("/api/v1/tasks", json=task_payload, headers=headers)
    assert res.status_code == 403