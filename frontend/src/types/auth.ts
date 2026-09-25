export interface Role {
  id: number;
  name: string;
  description: string;
}

/** Module -> granted actions (e.g. `{ patients: ["view", "create"] }`),
 * computed server-side from the user's Role/Permission grants (see
 * `User.permitted_modules()`). The single source of truth for what a role
 * can do stays the backend RBAC tables — the frontend only reads this to
 * decide what to show, never to decide what to allow (CLAUDE.md §9). */
export type ModulePermissions = Record<string, string[]>;

export interface CurrentUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  hospital: string | null;
  role: Role | null;
  is_active: boolean;
  permissions: ModulePermissions;
}

export function canView(user: CurrentUser | null, module: string): boolean {
  return user?.permissions[module]?.includes("view") ?? false;
}

/** Mirrors `Role.Name` in `backend/apps/users/models.py`, minus `patient` —
 * patients aren't `User` rows yet (CLAUDE.md §14), so there's no staff
 * login for that role to select. Used by the login screen's role picker;
 * it's a UX confirmation only (see `Login.tsx`) — the account's real role,
 * returned by the backend after authentication, is what actually governs
 * access either way. */
export const STAFF_ROLE_OPTIONS = [
  { value: "system_admin", label: "System Administrator" },
  { value: "hospital_admin", label: "Hospital Administrator" },
  { value: "doctor", label: "Doctor" },
  { value: "nurse", label: "Nurse" },
  { value: "receptionist", label: "Receptionist" },
  { value: "lab_technician", label: "Laboratory Technician" },
  { value: "pharmacist", label: "Pharmacist" },
] as const;

export interface TokenPair {
  access: string;
  refresh: string;
}
