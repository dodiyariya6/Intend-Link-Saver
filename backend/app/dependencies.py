"""
Shared FastAPI dependencies.

`get_current_user` is the auth dependency/middleware future protected
routers (links, search, tags) will depend on to require a logged-in user.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.user import User
from app.services import auth_service

# tokenUrl only matters for interactive docs (Swagger's "Authorize" button);
# actual token issuance happens via POST /auth/login.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Resolve the bearer token on the request into a User, or 401."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if token is None:
        raise credentials_exception

    user_id = auth_service.decode_access_token(token)
    if user_id is None:
        raise credentials_exception

    user = auth_service.get_user_by_id(db, user_id)
    if user is None:
        raise credentials_exception

    return user
