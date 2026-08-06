# Import all models here so Alembic's autogenerate (and anything else that
# needs Base.metadata fully populated) can discover them via a single import.
from app.models.user import User
from app.models.tag import Tag, link_tags
from app.models.link import Link

__all__ = ["User", "Tag", "link_tags", "Link"]
