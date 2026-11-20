import { AnimatePresence, motion } from 'framer-motion';
import {
  Banknote, Bell, Building2, CalendarDays, ChartNoAxesCombined, CircleDollarSign, FolderKanban,
  HandCoins, LayoutDashboard, Link2, Megaphone, Menu, NotebookPen, Receipt, Search, Settings, StickyNote, Target, Users, Wallet, X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context';
import { api, clearSession } from '@/lib/api';
import { NoteAlarms } from '@/pages/company';

const items = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, perm: 'dashboard.view' },
  { to: '/targets', label: 'Targets', icon: Target, perm: 'dashboard.view' },
  // { to: '/founders', label: 'Co-Founder Management', icon: Users, perm: 'founders.view' },
  { to: '/clients', label: 'Clients', icon: Building2, perm: 'clients.view' },
  { to: '/marketing', label: 'Marketing', icon: Megaphone, perm: 'clients.view' },
  { to: '/projects', label: 'Projects & Tasks', icon: FolderKanban, perm: 'projects.view' },
  
  { to: '/payments', label: 'Client Payments', icon: HandCoins, perm: 'payments.view' },
  // { to: '/income', label: 'Income', icon: CircleDollarSign, perm: 'income.view' },
  { to: '/expenses', label: 'Expenses', icon: Receipt, perm: 'expenses.view' },
  { to: '/personal', label: 'Personal account', icon: Banknote, perm: 'founderFinance.view' },
  { to: '/banks', label: 'Bank Accounts', icon: Wallet, perm: 'banks.view' },
  // { to: '/ledger', label: 'Ledger & Accounting', icon: Banknote, perm: 'ledger.view' },
  // { to: '/founder-finance', label: 'Founder Finance', icon: ChartNoAxesCombined, perm: 'founderFinance.view' },
  { to: '/invoices', label: 'Invoices', icon: Receipt, perm: 'invoices.view' },
  { to: '/employees', label: 'Employees', icon: Users, perm: 'employees.view' },
  // { to: '/attendance', label: 'Attendance', icon: CalendarDays, perm: 'attendance.view' },
  { to: '/salary', label: 'Salary', icon: Wallet, perm: 'salary.view' },
  // { to: '/calendar', label: 'Calendar', icon: CalendarDays, perm: 'calendar.view' },
  { to: '/works', label: 'Our works', icon: Link2, perm: 'dashboard.view' },
  { to: '/notes', label: 'Sticky Notes', icon: StickyNote, perm: 'notes.view' },
  { to: '/reports', label: 'Reports & Analytics', icon: ChartNoAxesCombined, perm: 'reports.view' },
  { to: '/notifications', label: 'Notifications', icon: Bell, perm: 'notifications.view' },
  { to: '/settings', label: 'Settings', icon: Settings, perm: 'settings.view' },
];

export function Layout() {
  const { user, can, setUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState('');
  const [unread, setUnread] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);
  useEffect(() => {
    if (!can('notifications.view')) return;
    api.get('/notifications').then((response) => setUnread(response.data.unread || 0)).catch(() => undefined);
  }, [location.pathname]);

  const visible = items.filter((item) => can(item.perm) || (item.to === '/founders' && can('founderFinance.view')));

  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-bg text-ink">
      <div className="flex min-h-screen">
        <aside className={`fixed inset-y-0 left-0 z-40 flex w-[min(86vw,280px)] flex-col bg-black text-white transition-all lg:w-[272px] ${collapsed ? 'lg:w-[84px]' : ''} ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
          <div className="flex items-center gap-3 px-5 py-5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-lime text-xs font-bold text-black">DM</span>
            {!collapsed && <p className="text-sm font-semibold tracking-[0.16em]">DARK MEDIA</p>}
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
            {visible.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} className={() => {
                const active = item.to === '/' ? location.pathname === '/' || location.pathname.startsWith('/dashboard') : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
                return `relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${active ? 'bg-white/10 text-white' : 'text-neutral-300 hover:bg-white/5 hover:text-white'}`;
              }}>
                {() => {
                  const active = item.to === '/' ? location.pathname === '/' || location.pathname.startsWith('/dashboard') : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
                  return (
                  <>
                    {active && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-lime" />}
                    <item.icon size={18} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </>
                  );
                }}
              </NavLink>
            ))}
          </nav>
          {!collapsed && <a className="mx-3 mb-1 flex min-h-11 items-center rounded-xl px-3 text-sm text-neutral-300 hover:bg-white/5" href="/download/demo-erp.apk">Android APK</a>}
          <button className="m-3 hidden rounded-xl border border-darkline px-3 py-2 text-xs text-neutral-300 lg:block" type="button" onClick={() => setCollapsed((value) => !value)}>{collapsed ? 'Expand' : 'Collapse'}</button>
        </aside>
        {open && <button className="fixed inset-0 z-30 bg-black/50 lg:hidden" aria-label="Close menu" onClick={() => setOpen(false)} />}
        <div className={`flex min-w-0 flex-1 flex-col ${collapsed ? 'lg:pl-[84px]' : 'lg:pl-[272px]'}`}>
          <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-bg/90 px-3 py-2 backdrop-blur sm:gap-3 sm:px-4 sm:py-3" style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}>
            <button className="grid h-11 w-11 shrink-0 place-items-center rounded-xl lg:hidden" type="button" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={18} /></button>
            <form className="relative min-w-0 flex-1" onSubmit={(event) => { event.preventDefault(); if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`); }}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
              <input className="h-11 w-full rounded-2xl border border-line bg-card pl-9 pr-3 text-base outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime sm:text-sm" placeholder="Search" value={query} onChange={(event) => setQuery(event.target.value)} />
            </form>
            <button className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl" type="button" onClick={() => navigate('/notifications')} aria-label="Notifications">
              <Bell size={18} />
              {unread > 0 && <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-lime px-1 text-[10px] font-bold text-black">{unread}</span>}
            </button>
            <div className="hidden min-w-0 text-right lg:block">
              <p className="truncate text-sm font-semibold">{user?.name}</p>
              <p className="text-xs capitalize text-secondary">{user?.role.replaceAll('_', ' ')}</p>
            </div>
            <button className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-secondary" type="button" aria-label="Sign out" onClick={async () => { clearSession(); await api.post('/auth/logout').catch(() => undefined); setUser(null); navigate('/login'); }}><X size={16} /></button>
          </header>
          <main className="mx-auto w-full max-w-[1440px] min-w-0 flex-1 px-3 py-4 sm:px-6 sm:py-6" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
            <AnimatePresence mode="wait">
              <motion.div key={location.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
      <NoteAlarms />
    </div>
  );
}
