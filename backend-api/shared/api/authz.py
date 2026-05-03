from enum import Enum
from typing import Set

class Permission(str, Enum):
    MANAGE_TENANT = "manage:tenant"
    MANAGE_EVENT = "manage:event"
    MANAGE_PAYMENTS = "manage:payments"
    VIEW_STUDENTS = "view:students"
    MANAGE_STUDENTS = "manage:students"
    MANAGE_LAYOUTS = "manage:layouts"

ROLE_PERMISSIONS: dict[str, Set[Permission]] = {
    # Tenant / System Roles
    "SUPER_ADMIN": {
        Permission.MANAGE_TENANT,
        Permission.MANAGE_EVENT,
        Permission.MANAGE_PAYMENTS,
        Permission.VIEW_STUDENTS,
        Permission.MANAGE_STUDENTS,
        Permission.MANAGE_LAYOUTS,
    },
    "TENANT_ADMIN": {
        Permission.MANAGE_EVENT,
        Permission.MANAGE_PAYMENTS,
        Permission.VIEW_STUDENTS,
        Permission.MANAGE_STUDENTS,
        Permission.MANAGE_LAYOUTS,
    },
    "ADMIN": {  # Legacy role mapping
        Permission.MANAGE_EVENT,
        Permission.MANAGE_PAYMENTS,
        Permission.VIEW_STUDENTS,
        Permission.MANAGE_STUDENTS,
        Permission.MANAGE_LAYOUTS,
    },
    "OWNER": {  # Legacy role mapping
        Permission.MANAGE_EVENT,
        Permission.MANAGE_PAYMENTS,
        Permission.VIEW_STUDENTS,
        Permission.MANAGE_STUDENTS,
        Permission.MANAGE_LAYOUTS,
    },
    
    # Event-Level Roles
    "ORGANIZER": {
        Permission.MANAGE_EVENT,
        Permission.MANAGE_PAYMENTS,
        Permission.VIEW_STUDENTS,
        Permission.MANAGE_STUDENTS,
        Permission.MANAGE_LAYOUTS,
    },
    "COORDINATOR": {
        Permission.MANAGE_PAYMENTS,
        Permission.VIEW_STUDENTS,
        Permission.MANAGE_STUDENTS,
        Permission.MANAGE_LAYOUTS,
    },
    "CASHIER": {
        Permission.MANAGE_PAYMENTS,
        Permission.VIEW_STUDENTS,
    },
    "REVIEWER": {
        Permission.VIEW_STUDENTS,
    }
}

def get_role_permissions(role: str) -> Set[Permission]:
    return ROLE_PERMISSIONS.get(role, set())
