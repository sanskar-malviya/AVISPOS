import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from './auth';
import { useOnline } from './useOnline';
import { useShopData } from './data';
import { OfflineBanner } from './OfflineBanner';
import { PrinterButton } from '../components/PrinterButton';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { hasUnsyncedWrites } from '../data/orders';

function OnlineDot() {
  const online = useOnline();
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span
        className={
          'inline-block w-2.5 h-2.5 rounded-full ' +
          (online ? 'bg-green-400' : 'bg-amber-400')
        }
      />
      <span
        className={
          'hidden sm:inline ' + (online ? 'text-white/80' : 'text-amber-200 font-bold')
        }
      >
        {online ? 'Online' : 'Offline'}
      </span>
      <span className="sr-only sm:hidden">{online ? 'Online' : 'Offline'}</span>
    </span>
  );
}

const navItem =
  'px-2.5 sm:px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap';

export function Layout() {
  const { role, user, signOutUser } = useAuth();
  const { settings } = useShopData();
  const navigate = useNavigate();
  const [unsyncedWarning, setUnsyncedWarning] = useState(false);

  async function signOutNow() {
    setUnsyncedWarning(false);
    await signOutUser();
    navigate('/login');
  }

  return (
    <div className="flex flex-col h-full">
      <OfflineBanner />
      <header className="shrink-0 h-14 bg-tandoori-700 text-white flex items-center justify-between px-2 sm:px-4 gap-2 sm:gap-3">
        {/* On phones only the logo shows, so the menu buttons fit. */}
        <div className="flex items-center gap-2 min-w-0 shrink-0 md:shrink">
          <img
            src="/brand/logo.jpg"
            alt={settings.businessName}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover ring-2 ring-white/40 shrink-0"
            draggable={false}
          />
          <span className="hidden md:inline text-xs font-bold bg-veg-600 rounded px-1.5 py-0.5 shrink-0">
            {settings.vegLabel || 'VEG'}
          </span>
          <span className="hidden md:inline font-bold truncate">{settings.businessName}</span>
        </div>

        <nav className="flex items-center gap-0.5 sm:gap-1 min-w-0">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              navItem +
              (isActive ? ' bg-white/20' : ' hover:bg-white/10')
            }
          >
            Billing
          </NavLink>
          {role === 'owner' && (
            <>
              <NavLink
                to="/orders"
                className={({ isActive }) =>
                  navItem + (isActive ? ' bg-white/20' : ' hover:bg-white/10')
                }
              >
                Orders
              </NavLink>
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  navItem + (isActive ? ' bg-white/20' : ' hover:bg-white/10')
                }
              >
                Settings
              </NavLink>
            </>
          )}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <PrinterButton />
          <OnlineDot />
          <span className="hidden xl:inline text-xs text-white/70 max-w-[10rem] truncate">
            {user?.email}
          </span>
          <button
            onClick={async () => {
              if (await hasUnsyncedWrites()) setUnsyncedWarning(true);
              else await signOutNow();
            }}
            aria-label="Sign out"
            title={user?.email ? `Sign out ${user.email}` : 'Sign out'}
            className="text-sm font-semibold px-2.5 sm:px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20"
          >
            <span className="sm:hidden" aria-hidden>
              ⏻
            </span>
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-hidden">
        <Outlet />
      </main>

      <ConfirmDialog
        open={unsyncedWarning}
        title="Sales not uploaded yet"
        danger
        message={
          <>
            Some sales on this tablet haven't reached the cloud yet (no or slow internet). If you
            sign out now, they upload only when <strong>{user?.email}</strong> signs in on this
            tablet again. Best: stay signed in until the internet is back.
          </>
        }
        cancelLabel="Stay signed in"
        confirmLabel="Sign out anyway"
        onConfirm={() => void signOutNow()}
        onCancel={() => setUnsyncedWarning(false)}
      />
    </div>
  );
}
