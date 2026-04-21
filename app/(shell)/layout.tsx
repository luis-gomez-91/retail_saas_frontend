import { AppShell } from '@/components/app-shell'
import { AuthGate } from '@/components/auth-gate'
import { MeProvider } from '@/components/me-provider'

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGate>
      <MeProvider>
        <AppShell>{children}</AppShell>
      </MeProvider>
    </AuthGate>
  )
}
