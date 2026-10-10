import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from './auth';
import { useOnline } from './useOnline';
import { useShopData } from './data';
import { OfflineBanner } from './OfflineBanner';
import { PrinterButton } from '../components/PrinterButton';

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
      <span className={online ? 'text-white/80' : 'text-amber-200 font-bold'}>
        {online ? 'Online' : 'Offline'}
      </span>
    </span>
  );
}

const navItem =
  'px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors';

export function Layout() {
  const { role, user, signOutUser } = useAuth();
  const { settings } = useShopData();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-full">
      <OfflineBanner />
      <header className="shrink-0 h-14 bg-tandoori-700 text-white flex items-center justify-between px-4 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <img
            src="/brand/logo.jpg"
            alt=""
            className="w-10 h-10 rounded-full object-cover ring-2 ring-white/40 shrink-0"
            draggable={false}
          />
          <span className="text-xs font-bold bg-veg-600 rounded px-1.5 py-0.5">
            {settings.vegLabel || 'VEG'}
          </span>
          <span className="font-bold truncate">{settings.businessName}</span>
        </div>

        <nav className="flex items-center gap-1">
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

        <div className="flex items-center gap-3">
          <PrinterButton />
          <OnlineDot />
          <span className="hidden sm:inline text-xs text-white/70 max-w-[10rem] truncate">
            {user?.email}
          </span>
          <button
            onClick={async () => {
              await signOutUser();
              navigate('/login');
            }}
            className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
