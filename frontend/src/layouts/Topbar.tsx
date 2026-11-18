import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, FlaskConical, Menu as MenuIcon, Plus, PlugZap, Search, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Logo } from '@/components/brand/Logo';
import { syncStateOf } from '@/components/data/SyncStatus';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Menu } from '@/components/ui/Menu';
import { useWorkspace } from '@/hooks/useWorkspace';
import { accountsApi } from '@/services/bloomApi';
import { cn } from '@/utils/cn';
import { qk } from '@/utils/queryKeys';
import { QUICK_ACTIONS } from './CommandPalette';
import { NAV_GROUPS, NAV_TOP_END, NAV_TOP_START, SECONDARY_NAV, type NavEntry, type NavItem } from './navigation';

const pill = 'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-all duration-200';
const pillIdle = 'text-fg-2 hover:-translate-y-px hover:bg-accent-soft hover:text-accent-hover';
const pillActive = 'bg-accent-soft text-accent-hover';
const isEnd = (to: string) => to === '/' || to === '/settings';

function TopLink({ item }: { item: NavItem }) {
  return (
    <NavLink to={item.to} end={isEnd(item.to)} className={({ isActive }) => cn(pill, isActive ? pillActive : pillIdle)}>
      <span data-nav-label>{item.label}</span>
    </NavLink>
  );
}

/** Dropdown row: icon bubble, label and (optionally) a one-line description. */
function MenuLink({ item, tone = 2 }: { item: NavItem & { description?: string }; tone?: 1 | 2 | 3 }) {
  return (
    <li>
      <NavLink
        to={item.to}
        end={isEnd(item.to)}
        className={({ isActive }) => cn('flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-all duration-200 hover:translate-x-0.5 hover:bg-[rgb(var(--purple-soft))]', isActive && 'bg-surface-2')}
      >
        <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-fg', `tone-${tone}`)}>
          <item.icon className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <span className="min-w-0">
          <span data-nav-label className="block text-sm font-extrabold text-fg">{item.label}</span>
          {item.description && <span className="block text-xs font-semibold text-fg-2">{item.description}</span>}
        </span>
      </NavLink>
    </li>
  );
}

/** Opens on hover (with a short close delay so the pointer can travel), on click/Enter, closes on Esc or blur. */
function HoverMenu({ trigger, active, align = 'center', label, children }: { trigger: ReactNode; active?: boolean; align?: 'center' | 'right'; label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const timer = useRef<number>();
  const root = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const show = () => {
    window.clearTimeout(timer.current);
    setOpen(true);
  };
  const hide = () => {
    timer.current = window.setTimeout(() => setOpen(false), 140);
  };
  return (
    <div
      ref={root}
      className="relative"
      onMouseEnter={show}
      onMouseLeave={hide}
      onBlur={(e) => !root.current?.contains(e.relatedTarget as Node | null) && setOpen(false)}
      onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
    >
      <button type="button" aria-haspopup="true" aria-expanded={open} aria-label={label} onClick={() => setOpen((o) => !o)} className={cn(pill, active || open ? pillActive : pillIdle)}>
        {trigger}
      </button>
      <div
        data-open={open}
        className={cn(
          'nav-pop absolute top-full z-40 pt-3 transition duration-200 ease-out',
          align === 'right' ? 'right-0 origin-top-right' : 'left-1/2 origin-top -translate-x-1/2',
          open ? 'visible translate-y-0 scale-100 opacity-100' : 'invisible translate-y-2 scale-95 opacity-0',
        )}
      >
        <ul className="min-w-[270px] rounded-3xl border-2 border-border bg-surface p-2 shadow-[0_16px_36px_rgba(139,92,246,0.16)]">{children}</ul>
      </div>
    </div>
  );
}

/** Logo, hover-menu navigation, search, quick-create and workspace/account menu. Becomes a tap menu on small screens. */
export function Topbar({ onOpenCommand }: { onOpenCommand: () => void }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { workspaces, current, select } = useWorkspace();
  const [mobileOpen, setMobileOpen] = useState(false);
  const accounts = useQuery({ queryKey: qk.accounts, queryFn: accountsApi.list, enabled: Boolean(current) });
  const attention = (accounts.data ?? []).filter((a) => ['NEEDS_RECONNECT', 'ERROR'].includes(syncStateOf(a))).length;
  const syncing = (accounts.data ?? []).filter((a) => syncStateOf(a) === 'SYNCING').length;
  const inGroup = (items: NavItem[]) => items.some((n) => pathname === n.to || pathname.startsWith(n.to + '/'));
  useEffect(() => setMobileOpen(false), [pathname]);

  return (
    <header className="sticky top-0 z-30 border-b-2 border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1240px] items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" aria-label="Bloom home" className="rounded-full"><Logo /></Link>

        <nav aria-label="Main" className="flex flex-1 items-center">
          <div className="hidden items-center gap-1 lg:ml-4 lg:flex">
            <TopLink item={NAV_TOP_START} />
            {NAV_GROUPS.map((g) => (
              <HoverMenu key={g.label} label={g.label} active={inGroup(g.items)} trigger={<>{g.label}<ChevronDown className={cn('h-4 w-4 transition-transform duration-200')} aria-hidden /></>}>
                {g.items.map((i: NavEntry) => <MenuLink key={i.to} item={i} tone={i.tone} />)}
              </HoverMenu>
            ))}
            <TopLink item={NAV_TOP_END} />
          </div>

          <div className="ml-auto flex items-center gap-2">
            {(attention > 0 || syncing > 0) && (
              <Button size="sm" variant="ghost" onClick={() => navigate('/settings/connected-accounts')} className={attention > 0 ? 'text-danger' : 'text-info'}>
                <PlugZap />
                <span className="hidden xl:inline">{attention > 0 ? (attention === 1 ? '1 account needs attention' : `${attention} accounts need attention`) : `Syncing ${syncing}`}</span>
              </Button>
            )}
            <button type="button" onClick={onOpenCommand} aria-label="Open command menu" className="hidden h-10 items-center gap-2 rounded-full border-2 border-border bg-surface px-4 text-sm text-fg-3 transition-colors hover:border-border-strong hover:text-fg md:inline-flex">
              <Search className="h-4 w-4" /> Search <kbd className="rounded-md bg-surface-2 px-1.5 font-sans text-2xs">⌘K</kbd>
            </button>
            <IconButton label="Search" icon={<Search />} onClick={onOpenCommand} className="md:hidden" />

            <Menu
              label="Create"
              trigger={<Button size="md" variant="primary" aria-label="Create"><Plus /><span className="hidden sm:inline">New</span></Button>}
              items={QUICK_ACTIONS.map((a) => ({ label: a.label, onSelect: () => navigate(a.to) }))}
            />

            <HoverMenu label="Workspace and settings" align="right" active={inGroup(SECONDARY_NAV)} trigger={<span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[#F0509A] to-[#8B5CF6] font-extrabold text-white">{(current?.name ?? 'B').charAt(0).toUpperCase()}</span>}>
              <li className="px-3 pb-1 pt-2 text-xs font-bold text-fg-3">Workspace</li>
              {workspaces.map((w) => (
                <li key={w.id}>
                  <button type="button" onClick={() => select(w.id)} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-extrabold transition-colors hover:bg-[rgb(var(--purple-soft))]">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl tone-3">{w.demo ? <FlaskConical className="h-[18px] w-[18px]" aria-hidden /> : w.id === current?.id ? <Check className="h-[18px] w-[18px]" aria-hidden /> : null}</span>
                    <span className="truncate">{w.demo ? `${w.name} (synthetic data)` : w.name}</span>
                    {w.id === current?.id && <Check className="ml-auto h-4 w-4 text-accent" aria-label="Current" />}
                  </button>
                </li>
              ))}
              <li className="my-1 border-t-2 border-dashed border-border" aria-hidden />
              {SECONDARY_NAV.map((n, i) => <MenuLink key={n.to} item={n} tone={i === 0 ? 3 : 2} />)}
            </HoverMenu>

            <IconButton label={mobileOpen ? 'Close navigation' : 'Open navigation'} icon={mobileOpen ? <X /> : <MenuIcon />} onClick={() => setMobileOpen((o) => !o)} className="lg:hidden" tooltip={false} />
          </div>
        </nav>
      </div>

      {mobileOpen && (
        <div className="border-t-2 border-border bg-surface px-4 pb-4 pt-2 lg:hidden">
          <ul className="mx-auto grid max-w-[1240px] gap-0.5">
            <MenuLink item={NAV_TOP_START} tone={1} />
            {NAV_GROUPS.flatMap((g) => g.items).map((i) => <MenuLink key={i.to} item={i} tone={i.tone} />)}
            <MenuLink item={NAV_TOP_END} tone={3} />
          </ul>
        </div>
      )}
    </header>
  );
}
