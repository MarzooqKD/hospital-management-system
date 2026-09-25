import type { ComponentType } from "react";
import { NavLink } from "react-router-dom";

interface SidebarNavItemProps {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
}

/** Styled for the dark-navy sidebar (see AppLayout) — active item gets the
 * teal accent pill, inactive items sit as muted slate-blue text so they
 * read against the navy background without competing with the accent. */
export function SidebarNavItem({ to, label, icon: Icon, end }: SidebarNavItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [
          "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
          isActive
            ? "bg-accent-500 text-white shadow-sm"
            : "text-slate-300 hover:bg-white/10 hover:text-white",
        ].join(" ")
      }
    >
      <Icon className="h-5 w-5 shrink-0" />
      {label}
    </NavLink>
  );
}
