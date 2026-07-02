import {
  FileDown,
  Gauge,
  PackageCheck,
  SlidersHorizontal,
  Store,
  UserPlus,
} from 'lucide-react'
import type { ComponentType } from 'react'

export type PageKey =
  | 'overview'
  | 'accounts'
  | 'catalog'
  | 'locations'
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
    title: 'Admin Sales Overview',
    summary: 'Monitor branch sales and latest encoded records.',
  },
  {
    key: 'accounts',
    path: '/accounts',
    label: 'Accounts',
    icon: UserPlus,
    eyebrow: 'Account management',
    title: 'Create and manage staff accounts',
    summary:
      'Create admin, kitchen, and branch profiles, edit access, and manage workspace assignments.',
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
    key: 'reports',
    path: '/reports',
    label: 'Reports',
    icon: FileDown,
    eyebrow: 'Production exports',
    title: 'Daily production reports',
    summary:
      'Generate revised kitchen, branch, or whole-Bonibe daily workflow reports.',
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
