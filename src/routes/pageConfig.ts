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
      'Review production, branch sales, reconciliation, reports, and device sync health.',
  },
  {
    key: 'accounts',
    path: '/accounts',
    label: 'Accounts',
    icon: UserPlus,
    eyebrow: 'Account management',
    title: 'Create and manage staff accounts',
    summary:
      'Create admin, kitchen, and branch accounts, edit access, and send password reset emails.',
  },
  {
    key: 'staff',
    path: '/staff',
    label: 'Staff',
    icon: UsersRound,
    eyebrow: 'Provisioning',
    title: 'Staff accounts and role assignment',
    summary:
      'Manage staff details and assign Kitchen, Branch, or Admin access.',
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
      'Find generated receipts, files, and reports by branch or kitchen, then preview or download them.',
  },
  {
    key: 'settings',
    path: '/settings',
    label: 'Settings',
    icon: SlidersHorizontal,
    eyebrow: 'Setup',
    title: 'Admin app configuration',
    summary:
      'Manage company header details and owner-facing account reminders.',
  },
]

export function getPage(pageKey: PageKey) {
  return pages.find((page) => page.key === pageKey)!
}
