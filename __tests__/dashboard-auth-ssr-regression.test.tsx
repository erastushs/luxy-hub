import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}))

vi.mock('@/app/actions/auth', () => ({
  logout: vi.fn(),
}))

import DashboardError from '@/app/dashboard/error'
import DashboardLayout from '@/app/dashboard/layout'

describe('dashboard SSR auth regression coverage', () => {
  it('dashboard layout renders shell without performing duplicate auth validation', async () => {
    const layout = await DashboardLayout({
      children: <section>Protected page content</section>,
    })

    const html = renderToStaticMarkup(layout)

    expect(html).toContain('Protected page content')
    expect(html).toContain('Skip to main content')
  })

  it('dashboard error boundary renders a safe retry UI without stack traces or raw 500/502 text', () => {
    const html = renderToStaticMarkup(
      <DashboardError
        error={new Error('database password leaked in stack')}
        reset={vi.fn()}
      />
    )

    expect(html).toContain('Dashboard unavailable')
    expect(html).toContain('Something went wrong')
    expect(html).toContain('Retry')
    expect(html).not.toContain('database password')
    expect(html).not.toContain('stack')
    expect(html).not.toContain('502 Bad Gateway')
    expect(html).not.toContain('500 Internal Server Error')
  })
})
