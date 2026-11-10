from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from src.utils.settings import settings

# MySQL Production Engine with Connection Pooling
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,     
    pool_size=10,            
    pool_recycle=3600,      
    max_overflow=20          
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Modern SQLAlchemy 2.0 Base
class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()