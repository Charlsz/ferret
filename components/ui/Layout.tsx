import { ReactNode } from 'react';

/**
 * components/ui/Layout.tsx
 *
 * Basic visual component. We keep Next.js ('app/layout.tsx') clean,
 * isolating components that might be client/server.
 */

interface DashboardLayoutProps {
  children: ReactNode;
  sidebar?: ReactNode;
}

export function DashboardLayout({ children, sidebar }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden text-gray-900">
      {sidebar && (
        <aside className="w-64 border-r bg-white p-4 overflow-y-auto">
          {sidebar}
        </aside>
      )}
      <main className="flex-1 overflow-y-auto p-6 relative">
        {children}
      </main>
    </div>
  );
}
