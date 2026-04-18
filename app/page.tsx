import { DashboardLayout } from '@/components/ui/Layout';
import { WorkspaceManager } from '@/components/WorkspaceManager';

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

        {/* Phase 2 Component: File System Manager */}
        <WorkspaceManager />
        
        {/* Placeholder for Phase 3/4 components */}
        <div className="bg-gray-100 border border-gray-200 rounded-xl p-8 text-center text-gray-500 border-dashed">
          <p>Search & AI Integration coming next...</p>
        </div>
      </div>
    </DashboardLayout>
  );
}

