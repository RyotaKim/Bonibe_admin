import { LogOut, Search, ShieldCheck } from 'lucide-react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { AccountsPage } from '../../pages/AccountsPage'
import { CatalogPage } from '../../pages/CatalogPage'
import { LocationsPage } from '../../pages/LocationsPage'
import { OverviewPage } from '../../pages/OverviewPage'
import { ReportsPage } from '../../pages/ReportsPage'
import { SettingsPage } from '../../pages/SettingsPage'
import { StaffPage } from '../../pages/StaffPage'
import { SyncReviewPage } from '../../pages/SyncReviewPage'
import { pages } from '../../routes/pageConfig'
import type { Profile } from '../../types/admin'
import { getSupabaseStatus, supabase } from '../../lib/supabase'

export function AdminLayout({ profile }: { profile: Profile }) {
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Admin navigation">
        <div className="brand">
          <img src="/bonibe_logo.jpg" alt="Bonibe Bakeshop" />
          <div>
            <strong>Bonibe</strong>
            <span>Admin</span>
          </div>
        </div>

        <nav className="nav-list">
          {pages.map((page) => (
            <NavLink
              key={page.path}
              to={page.path}
              end={page.path === '/'}
              className={({ isActive }) =>
                isActive ? 'nav-link active' : 'nav-link'
              }
            >
              <page.icon size={18} />
              <span>{page.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="workspace">
        <TopBar profile={profile} />
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/staff" element={<StaffPage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/locations" element={<LocationsPage />} />
          <Route path="/sync" element={<SyncReviewPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  )
}

function TopBar({ profile }: { profile: Profile }) {
  const supabaseStatus = getSupabaseStatus()

  return (
    <header className="topbar">
      <label className="search-control">
        <Search size={18} />
        <input type="search" placeholder="Search inside the current page" />
      </label>
      <div className="status-row">
        <span className="status-pill online">
          <ShieldCheck size={16} />
          {supabaseStatus.label}
        </span>
        <span className="profile-pill">{profile.staff_name}</span>
        <button
          className="icon-button"
          type="button"
          aria-label="Sign out"
          onClick={() => void supabase?.auth.signOut()}
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  )
}
