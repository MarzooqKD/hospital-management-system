import {
  BedDouble,
  CalendarDays,
  FlaskConical,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  Package,
  Pill,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Outlet, useLocation } from "react-router-dom";
import { Avatar, SidebarNavItem } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { canView } from "../types/auth";

/** `module: null` means every authenticated user sees it regardless of role
 * (just Dashboard today). Everything else is hidden unless the signed-in
 * user's Role holds `<module>.view` — CLAUDE.md §9: a role should never even
 * see a module in the nav it has no access to, not just be blocked from it. */
const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true, module: null },
  { to: "/patients", label: "Patients", icon: Users, module: "patients" },
  { to: "/appointments", label: "Appointments", icon: CalendarDays, module: "appointments" },
  { to: "/queue", label: "Queue", icon: ListOrdered, module: "queue" },
  { to: "/laboratory", label: "Laboratory", icon: FlaskConical, module: "laboratory" },
  { to: "/pharmacy", label: "Pharmacy", icon: Pill, module: "pharmacy" },
  { to: "/inventory", label: "Inventory", icon: Package, module: "inventory" },
  { to: "/admissions", label: "Admissions", icon: BedDouble, module: "admissions" },
  { to: "/referrals", label: "Referrals", icon: Send, module: "referrals" },
] as const;

/** Best-effort page title from the route — covers nested/dynamic routes
 * (e.g. `/patients/:id`, `/visits/:visitId`) that don't have their own
 * NAV_ITEMS entry, by matching on path prefix rather than exact path. */
function getPageTitle(pathname: string): string {
  if (pathname === "/") return "Dashboard";
  if (pathname.startsWith("/patients")) return "Patients";
  if (pathname.startsWith("/appointments")) return "Appointments";
  if (pathname.startsWith("/queue")) return "Queue";
  if (pathname.startsWith("/visits")) return "Visit";
  if (pathname.startsWith("/laboratory")) return "Laboratory";
  if (pathname.startsWith("/pharmacy")) return "Pharmacy";
  if (pathname.startsWith("/inventory")) return "Inventory";
  if (pathname.startsWith("/admissions")) return "Admissions";
  if (pathname.startsWith("/referrals")) return "Referrals";
  return "Ghana HMS";
}

function humanize(slug: string): string {
  return slug
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const visibleNavItems = NAV_ITEMS.filter(
    (item) => item.module === null || canView(user, item.module),
  );
  const displayName =
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.email || "";
  const roleLabel = user?.role
    ? user.role.description || humanize(user.role.name)
    : null;

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-20 flex w-60 flex-col bg-navy-950 px-4 py-6">
        <div className="flex items-center gap-2.5 px-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-500">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <div className="leading-tight">
            <p className="text-base font-semibold text-white">HMS</p>
            <p className="text-xs text-slate-400">Hospital Management</p>
          </div>
        </div>

        <p className="mt-8 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Menu
        </p>
        <nav className="mt-2 flex flex-1 flex-col gap-1">
          {visibleNavItems.map(({ module: _module, ...item }) => (
            <SidebarNavItem key={item.to} {...item} />
          ))}
        </nav>

        <button
          type="button"
          onClick={() => logout()}
          className="flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          Sign out
        </button>
      </aside>

      <div className="ml-60 flex min-h-screen flex-col">
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-8">
          <h1 className="text-lg font-semibold text-navy-900">{getPageTitle(location.pathname)}</h1>
          {user && (
            <div className="flex items-center gap-3">
              <Avatar name={displayName} size="sm" />
              <div className="leading-tight">
                <p className="text-sm font-medium text-navy-900">{displayName}</p>
                {roleLabel && <p className="text-xs text-slate-500">{roleLabel}</p>}
              </div>
            </div>
          )}
        </header>

        <main className="flex-1 px-8 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
