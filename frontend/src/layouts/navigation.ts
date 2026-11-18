import {
  BarChart3,
  CalendarCheck2,
  HandCoins,
  LayoutDashboard,
  Link2,
  PenLine,
  Settings,
  Target,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

/** Primary navigation, in the order the product brief specifies. */
export const PRIMARY_NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/planly', label: 'Planly', icon: CalendarCheck2 },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/content-studio', label: 'Content Studio', icon: PenLine },
  { to: '/audience', label: 'Audience', icon: Users },
  { to: '/brand-earnings', label: 'Brand & Earnings', icon: HandCoins },
];

export const SECONDARY_NAV: NavItem[] = [
  { to: '/settings/connected-accounts', label: 'Connected accounts', icon: Link2 },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function titleForPath(pathname: string): string {
  const all = [...SECONDARY_NAV, ...PRIMARY_NAV];
  const match = all.find((n) => (n.to === '/' ? pathname === '/' : pathname === n.to || pathname.startsWith(n.to + '/')));
  return match?.label ?? 'Bloom';
}

/** Top-bar structure: single links plus hover dropdown groups. Every page from PRIMARY_NAV appears exactly once. */
export interface NavEntry extends NavItem {
  description: string;
  tone: 1 | 2 | 3;
}

const entry = (to: string, description: string, tone: 1 | 2 | 3): NavEntry => {
  const item = PRIMARY_NAV.find((n) => n.to === to)!;
  return { ...item, description, tone };
};

export const NAV_TOP_START: NavItem = PRIMARY_NAV[0]!;
export const NAV_GROUPS: { label: string; items: NavEntry[] }[] = [
  {
    label: 'Create',
    items: [
      entry('/planly', 'Schedule your content', 1),
      entry('/content-studio', 'Ideas and drafts', 2),
      entry('/goals', 'Track what you are growing', 3),
    ],
  },
  {
    label: 'Insights',
    items: [entry('/analytics', 'How your posts perform', 2), entry('/audience', 'Who follows you', 1)],
  },
];
export const NAV_TOP_END: NavItem = PRIMARY_NAV.find((n) => n.to === '/brand-earnings')!;
