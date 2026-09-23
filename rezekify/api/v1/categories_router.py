"""Categories Management Router."""

from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from rezekify.api.deps import get_current_user, get_db
from rezekify.db.models import Category, CategoryType, LedgerEntry, User

categories_router = APIRouter()


class CategoryCreateRequest(BaseModel):
    name: str
    category_type: CategoryType = CategoryType.EXPENSE
    icon: str = "tag"
    color: str = "#64748b"


class CategoryUpdateRequest(BaseModel):
    name: Optional[str] = None
    category_type: Optional[CategoryType] = None
    icon: Optional[str] = None
    color: Optional[str] = None


class CategoryResponse(BaseModel):
    id: UUID
    name: str
    category_type: CategoryType
    icon: Optional[str] = "tag"
    color: Optional[str] = "#64748b"

    model_config = ConfigDict(from_attributes=True)


# ponytail: in-memory sort only; add pagination & search when category count > 100 per tenant.
@categories_router.get("", response_model=List[CategoryResponse])
@categories_router.get("/", response_model=List[CategoryResponse])
def list_categories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lists all categories belonging to the authenticated user."""
    return (
        db.query(Category)
        .filter_by(user_id=current_user.id)
        .order_by(Category.name.asc())
        .all()
    )


@categories_router.post("", response_model=CategoryResponse)
@categories_router.post("/", response_model=CategoryResponse)
def create_category(
    req: CategoryCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Creates a new category for the authenticated user."""
    cat = Category(
        user_id=current_user.id,
        name=req.name.strip(),
        category_type=req.category_type,
        icon=req.icon.strip() if req.icon else "tag",
        color=req.color.strip() if req.color else "#64748b",
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@categories_router.put("/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: UUID,
    req: CategoryUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Updates an existing category for the authenticated user."""
    cat = (
        db.query(Category)
        .filter_by(id=category_id, user_id=current_user.id)
        .one_or_none()
    )
    if not cat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found.",
        )

    if req.name is not None:
        cat.name = req.name.strip()
    if req.category_type is not None:
        cat.category_type = req.category_type
    if req.icon is not None:
        cat.icon = req.icon.strip()
    if req.color is not None:
        cat.color = req.color.strip()

    db.commit()
    db.refresh(cat)
    return cat


@categories_router.delete("/{category_id}")
def delete_category(
    category_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Deletes a category and nullifies references in ledger entries."""
    cat = (
        db.query(Category)
        .filter_by(id=category_id, user_id=current_user.id)
        .one_or_none()
    )
    if not cat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found.",
        )

    db.query(LedgerEntry).filter(LedgerEntry.category_id == cat.id).update(
        {LedgerEntry.category_id: None}, synchronize_session=False
    )
    db.delete(cat)
    db.commit()
    return {"detail": "Category deleted."}
