import type { ReactNode } from 'react'
import { getPage, type PageKey } from '../../routes/pageConfig'

export function PageShell({
  pageKey,
  action,
  children,
}: {
  pageKey: PageKey
  action?: ReactNode
  children: ReactNode
}) {
  const page = getPage(pageKey)

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">{page.eyebrow}</span>
          <h1>{page.title}</h1>
          <p>{page.summary}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}
