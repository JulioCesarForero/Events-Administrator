from pydantic import Field

from shared.api.schemas import CamelModel


class PaginationParams(CamelModel):
    offset: int = Field(default=0, ge=0)
    limit: int = Field(default=50, ge=1, le=200)
