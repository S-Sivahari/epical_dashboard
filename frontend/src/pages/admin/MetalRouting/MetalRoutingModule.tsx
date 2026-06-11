import { useState } from 'react';
import { LayoutDashboard, Package, Grid3x3 } from 'lucide-react';
import { Dashboard } from './components/Dashboard';
import { PDKModule } from './components/PDKModule';
import { CellRouting } from './components/CellRouting';

type TabView = 'dashboard' | 'pdk-module' | 'cell-routing';

export function MetalRoutingModule() {
  const [activeTab, setActiveTab] = useState<TabView>('dashboard');

  const tabs = [
    { id: 'dashboard' as TabView, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'pdk-module' as TabView, label: 'PDK Module', icon: Package },
    { id: 'cell-routing' as TabView, label: 'Cell Routing', icon: Grid3x3 },
  ];

  return (
    <div className="flex h-full">
      {/* Left Sidebar */}
      <aside className="w-56 flex-shrink-0 border-r border-border bg-white">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-ink">Metal Routing</h2>
          <p className="text-xs text-muted mt-1">Analysis Module</p>
        </div>
        <nav className="p-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-colors duration-150
                  ${
                    isActive
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-ink hover:bg-surface hover:text-primary'
                  }
                `}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'pdk-module' && <PDKModule />}
        {activeTab === 'cell-routing' && <CellRouting />}
      </main>
    </div>
  );
}
