import { useGridStore } from '../store/gridStore';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ObjectLibrary } from './ObjectLibrary';
import { CreateObjectForm } from './CreateObjectForm';
import { ZoneControls } from './ZoneControls';

export function Sidebar() {
  const { sidebarOpen, setSidebarOpen } = useGridStore();

  return (
    <>
      <div
        className={`fixed left-0 top-0 h-full bg-white border-r border-gray-200 transition-transform duration-300 ease-in-out z-40 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ width: '320px' }}
      >
        <div className="h-full flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Object Library
                </h2>
                <ObjectLibrary />
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Create Custom Object
                </h2>
                <CreateObjectForm />
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Draw Zone
                </h2>
                <ZoneControls />
              </div>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className={`fixed top-4 z-50 bg-white border border-gray-300 rounded-md p-2 shadow-md hover:bg-gray-50 transition-all ${
          sidebarOpen ? 'left-[328px]' : 'left-4'
        }`}
        aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
      >
        {sidebarOpen ? (
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-600" />
        )}
      </button>
    </>
  );
}
