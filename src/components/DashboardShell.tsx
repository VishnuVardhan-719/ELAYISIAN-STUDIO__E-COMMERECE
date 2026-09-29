import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { Arrow } from "./ui";
import { DemoNotice } from "./ui";
export function DashboardShell({
  title,
  name,
  base,
  links,
  children,
}: {
  title: string;
  name: string;
  base: string;
  links: [string, string][];
  children: ReactNode;
}) {
  return (
    <div className="container dashboard">
      <aside className="dashboardSidebar">
        <p className="eyebrow">{title}</p>
        <h2>{name}</h2>
        <DemoNotice compact />
        <nav aria-label={`${title} navigation`}>
          {links.map(([path, label]) => (
            <NavLink end to={`${base}${path}`} key={path}>
              {label}
              <Arrow size={14} />
            </NavLink>
          ))}
        </nav>
        <Link className="textLink" to="/shop">
          Back to the shop
          <Arrow />
        </Link>
      </aside>
      <div className="dashboardContent">
        <DemoNotice />
        {children}
      </div>
    </div>
  );
}
