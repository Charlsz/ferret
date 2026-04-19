import { DashboardLayout } from '@/components/ui/Layout';
import { WorkspaceManager } from '@/components/WorkspaceManager';
import { SearchUI } from '@/components/SearchUI';
import { SystemControls } from '@/components/SystemControls';

export default function Home() {
  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto py-10 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Ferret</h1>
          <p className="text-gray-600 mt-2 text-lg">
            Local-first file search & AI explainer. Your files never leave your device.
          </p>
        </div>

        {/* Phase 2/3 Component: File System & IndexedDB */}
        <WorkspaceManager />
        
        {/* Phase 4/5 Component: High-Speed Web Worker Search + Explain Button */}
        <SearchUI />

        {/* Phase 6 Component: Zero Data Retention Control */}
        <SystemControls />
      </div>
    </DashboardLayout>
  );
}

