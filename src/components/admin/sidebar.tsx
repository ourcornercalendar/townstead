"use client";

import {
  Component,
  useState,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useOrg } from "@/hooks/use-org";
import { Calendar, CaretDown, MagnifyingGlass, X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  NAV_GROUPS,
  ALL_DESTINATIONS,
  DASHBOARD,
  SETTINGS,
  activeHref,
  matchesQuery,
  type NavItem,
  type NavGroup,
} from "./nav-items";

const OPEN_GROUPS_KEY = "townstead.admin.openGroups.v1";

function NavLink({
  item,
  active,
  onClick,
  indented,
  badge,
  subtitle,
  highlighted,
}: {
  item: NavItem;
  active: boolean;
  onClick?: () => void;
  indented?: boolean;
  badge?: number;
  subtitle?: string;
  highlighted?: boolean;
}) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      data-active={active || undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
        indented && "pl-9",
        active
          ? "border-l-3 border-primary bg-primary/10 text-foreground font-semibold"
          : "border-l-3 border-transparent text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
        highlighted && !active && "bg-sidebar-accent text-foreground"
      )}
    >
      <item.icon className={cn("size-5 shrink-0", item.color)} weight="duotone" />
      <span className="flex-1 truncate">
        {item.label}
        {subtitle && (
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
            {subtitle}
          </span>
        )}
      </span>
      {badge !== undefined && badge > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-semibold text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}

class QueryErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

/** The pending-approvals count, which must never take the sidebar down with it. */
function ApprovalBadgeInner({ item, active, onClick }: {
  item: NavItem;
  active: boolean;
  onClick?: () => void;
}) {
  const { isReady } = useOrg();
  const counts = useQuery(api.approvals.queries.countPending, isReady ? {} : "skip");
  return (
    <NavLink item={item} active={active} onClick={onClick} indented badge={counts?.total} />
  );
}

function ItemLink({ item, active, onClick }: {
  item: NavItem;
  active: boolean;
  onClick?: () => void;
}) {
  if (item.href === "/admin/approvals") {
    return (
      <QueryErrorBoundary
        fallback={<NavLink item={item} active={active} onClick={onClick} indented />}
      >
        <ApprovalBadgeInner item={item} active={active} onClick={onClick} />
      </QueryErrorBoundary>
    );
  }
  return <NavLink item={item} active={active} onClick={onClick} indented />;
}

function Group({
  group,
  current,
  open,
  onOpenChange,
  onClick,
}: {
  group: NavGroup;
  current: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClick?: () => void;
}) {
  const visible = group.items.filter((i) => !i.searchOnly);
  const containsCurrent = visible.some((i) => i.href === current);

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors hover:bg-sidebar-accent hover:text-foreground [&[data-state=open]>svg.chevron]:rotate-180",
          containsCurrent ? "text-foreground" : "text-muted-foreground"
        )}
      >
        <group.icon className={cn("size-5 shrink-0", group.color)} weight="duotone" />
        <span className="flex-1 text-left">{group.label}</span>
        <CaretDown className="chevron size-3.5 transition-transform duration-200" weight="bold" />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-0.5 pt-0.5">
        {visible.map((item) => (
          <ItemLink
            key={item.href}
            item={item}
            active={current === item.href}
            onClick={onClick}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * The jump box.
 *
 * There are more than thirty pages behind this sidebar. Grouping them well
 * makes the common ones findable; typing two letters makes all of them
 * findable, which is the difference between knowing where something is and
 * not having to.
 */
function JumpSearch({
  query,
  setQuery,
  inputRef,
  onSubmitFirst,
  onArrow,
}: {
  query: string;
  setQuery: (q: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSubmitFirst: () => void;
  onArrow: (delta: number) => void;
}) {
  return (
    <div className="relative px-3 pb-2">
      <MagnifyingGlass
        className="pointer-events-none absolute left-6 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        weight="bold"
      />
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSubmitFirst();
          } else if (e.key === "Escape") {
            setQuery("");
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            onArrow(1);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            onArrow(-1);
          }
        }}
        placeholder="Jump to…"
        aria-label="Search admin pages"
        className="h-9 w-full rounded-lg border border-border/60 bg-background pl-9 pr-8 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary [&::-webkit-search-cancel-button]:appearance-none"
      />
      {query && (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            inputRef.current?.focus();
          }}
          aria-label="Clear search"
          className="absolute right-5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" weight="bold" />
        </button>
      )}
    </div>
  );
}

/** Everything below the logo: the search box, and either results or the groups. */
function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const current = activeHref(pathname);

  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Groups start open. Hiding things by default is what made the old sidebar
  // hard to use, so the saved state can only ever be a choice the user made.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NAV_GROUPS.map((g) => [g.id, true]))
  );

  // Read the saved state after mount, never during render: reading
  // localStorage while rendering gives the server and the browser different
  // markup and React throws a hydration error.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(OPEN_GROUPS_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Record<string, boolean>;
      setOpenGroups((prev) => {
        const next = { ...prev };
        for (const g of NAV_GROUPS) {
          if (typeof saved[g.id] === "boolean") next[g.id] = saved[g.id];
        }
        return next;
      });
    } catch {
      // Private browsing, blocked storage, corrupt value — all fine, the
      // default is everything open.
    }
  }, []);

  const setGroupOpen = (id: string, open: boolean) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [id]: open };
      try {
        window.localStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify(next));
      } catch {
        // Not being able to remember the choice is not a reason to refuse it.
      }
      return next;
    });
  };

  // A group holding the page you are on opens itself, so you can always see
  // where you are even if you collapsed it earlier.
  useEffect(() => {
    const owner = NAV_GROUPS.find((g) => g.items.some((i) => i.href === current));
    if (owner && !openGroups[owner.id]) {
      setOpenGroups((prev) => ({ ...prev, [owner.id]: true }));
    }
    // openGroups deliberately omitted: including it would reopen the group
    // the moment the user collapsed it, which is a fight they would lose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const results = useMemo(
    () => (query.trim() ? ALL_DESTINATIONS.filter((e) => matchesQuery(e, query)) : []),
    [query]
  );

  useEffect(() => {
    setCursor(0);
  }, [query]);

  // Cmd/Ctrl-K focuses the box from anywhere in the admin.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (href: string) => {
    setQuery("");
    onNavigate?.();
    router.push(href);
  };

  const searching = query.trim().length > 0;

  return (
    <>
      <JumpSearch
        query={query}
        setQuery={setQuery}
        inputRef={inputRef}
        onSubmitFirst={() => {
          const hit = results[cursor] ?? results[0];
          if (hit) go(hit.item.href);
        }}
        onArrow={(delta) =>
          setCursor((c) =>
            results.length === 0 ? 0 : (c + delta + results.length) % results.length
          )
        }
      />

      {searching ? (
        <nav className="flex flex-col gap-0.5 px-3 pb-3" aria-label="Search results">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Nothing matches “{query.trim()}”.
            </p>
          ) : (
            results.map((entry, i) => (
              <NavLink
                key={entry.item.href}
                item={entry.item}
                active={current === entry.item.href}
                highlighted={i === cursor}
                subtitle={entry.group || undefined}
                onClick={() => {
                  setQuery("");
                  onNavigate?.();
                }}
              />
            ))
          )}
        </nav>
      ) : (
        <nav className="flex flex-col gap-0.5 px-3 pb-3" aria-label="Main">
          <NavLink item={DASHBOARD} active={current === DASHBOARD.href} onClick={onNavigate} />
          <div className="my-2 border-t border-border/40" />
          {NAV_GROUPS.map((group, i) => (
            <div key={group.id}>
              {i > 0 && <div className="my-1.5" />}
              <Group
                group={group}
                current={current}
                open={openGroups[group.id] ?? true}
                onOpenChange={(open) => setGroupOpen(group.id, open)}
                onClick={onNavigate}
              />
            </div>
          ))}
          <div className="my-2 border-t border-border/40" />
          <NavLink item={SETTINGS} active={current === SETTINGS.href} onClick={onNavigate} />
        </nav>
      )}
    </>
  );
}

export function AdminSidebar() {
  return (
    <aside className="hidden border-r border-border/60 bg-sidebar md:flex md:w-64 md:flex-col">
      <div className="flex h-14 items-center border-b border-border/60 px-5">
        <Link
          href="/admin"
          className="flex items-center gap-2.5 font-semibold tracking-tight text-foreground"
        >
          <Calendar className="size-5 text-primary" weight="duotone" />
          <span>Planner App</span>
        </Link>
      </div>
      <ScrollArea className="flex-1 py-3">
        <SidebarNav />
      </ScrollArea>
    </aside>
  );
}

export function AdminSidebarMobile({
  children,
  onNavigate,
}: {
  children: React.ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <div className="py-3">
      <SidebarNav onNavigate={onNavigate} />
      {children}
    </div>
  );
}
