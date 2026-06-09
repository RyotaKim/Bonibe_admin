import {
  ClipboardCheck,
  FileDown,
  Gauge,
  PackageCheck,
  SlidersHorizontal,
  Store,
  UserPlus,
  UsersRound,
} from 'lucide-react'
import type { ComponentType } from 'react'

export type PageKey =
  | 'overview'
  | 'accounts'
  | 'staff'
  | 'catalog'
  | 'locations'
  | 'sync'
  | 'reports'
  | 'settings'

export type PageConfig = {
  key: PageKey
  path: string
  label: string
  icon: ComponentType<{ size?: number }>
  eyebrow: string
  title: string
  summary: string
}

export const pages: PageConfig[] = [
  {
    key: 'overview',
    path: '/',
    label: 'Overview',
    icon: Gauge,
    eyebrow: 'Owner console',
    title: 'Bonibe operations at a glance',
    summary:
      'Review production, branch sales, reconciliation, reports, and sync health from Supabase.',
  },
  {
    key: 'accounts',
    path: '/accounts',
    label: 'Accounts',
    icon: UserPlus,
    eyebrow: 'Account creation',
    title: 'Create admin, kitchen, and branch accounts',
    summary:
      'Create Supabase Auth users and matching Bonibe staff profiles from one admin workflow.',
  },
  {
    key: 'staff',
    path: '/staff',
    label: 'Staff',
    icon: UsersRound,
    eyebrow: 'Provisioning',
    title: 'Staff accounts and role assignment',
    summary:
      'Manage profile rows for Supabase Auth users and assign Kitchen, Branch, or Admin access.',
  },
  {
    key: 'catalog',
    path: '/catalog',
    label: 'Catalog',
    icon: PackageCheck,
    eyebrow: 'Master data',
    title: 'Products, prices, and bundles',
    summary:
      'Maintain product availability, pricing, plate rules, thresholds, and bundle references.',
  },
  {
    key: 'locations',
    path: '/locations',
    label: 'Locations',
    icon: Store,
    eyebrow: 'Branches',
    title: 'Kitchen, branch, and client locations',
    summary:
      'Manage active locations and company report header details used across Bonibe documents.',
  },
  {
    key: 'sync',
    path: '/sync',
    label: 'Sync Review',
    icon: ClipboardCheck,
    eyebrow: 'Audit queue',
    title: 'Queued writes and failed sync review',
    summary:
      'Inspect retryable queue items, failures, payloads, attempts, and related audit events.',
  },
  {
    key: 'reports',
    path: '/reports',
    label: 'Reports',
    icon: FileDown,
    eyebrow: 'Exports',
    title: 'Central reports and document exports',
    summary:
      'Find generated report exports, filter by type or status, and open stored files.',
  },
  {
    key: 'settings',
    path: '/settings',
    label: 'Settings',
    icon: SlidersHorizontal,
    eyebrow: 'System',
    title: 'Admin app configuration',
    summary:
      'Confirm Supabase setup, RLS expectations, and the database policies needed by admin workflows.',
  },
]

export function getPage(pageKey: PageKey) {
  return pages.find((page) => page.key === pageKey)!
}
