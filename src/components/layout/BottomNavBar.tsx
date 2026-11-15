import React from 'react';
import {
  Table,
  LayoutDashboard,
  Plus,
  PhoneCall,
  MessageSquare
} from 'lucide-react';

export type BottomNavView = 'leads' | 'dashboard' | 'add' | 'calls' | 'whatsapp';

interface BottomNavBarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  onAddLead: () => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  currentView,
  onViewChange,
  onAddLead
}) => {
  const items: { id: BottomNavView; label: string; icon: React.FC<any>; action?: () => void }[] = [
    { id: 'leads', label: 'Leads', icon: Table },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'add', label: 'Add', icon: Plus, action: onAddLead },
    { id: 'calls', label: 'Calls', icon: PhoneCall },
    { id: 'whatsapp', label: 'Chat', icon: MessageSquare }
  ];

  return (
    <nav
      role="navigation"
      aria-label="Bottom Navigation"
      className="relative z-30 shrink-0 lg:hidden bg-[#FFFFFF]/95 dark:bg-[#111514]/95 backdrop-blur-md border-t border-[#E2E8F0] dark:border-[#334155] select-none font-body"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around h-14 max-w-lg mx-auto px-2">
        {items.map((item) => {
          const Icon = item.icon;
          const isAdd = item.id === 'add';
          const isActive = !isAdd && currentView === item.id;

          if (isAdd) {
            return (
              <button
                key={item.id}
                type="button"
                onClick={item.action}
                aria-label="Add new lead"
                className="flex flex-col items-center justify-center min-w-[48px] min-h-[44px]"
              >
                <div className="w-10 h-10 rounded-xl bg-[#00695C] dark:bg-[#80D5C4] text-white dark:text-[#003830] flex items-center justify-center shadow-sm hover:bg-[#005449] active:scale-95 transition-all">
                  <Icon className="w-5 h-5 stroke-[2.5]" />
                </div>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => (item.action ? item.action() : onViewChange(item.id))}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className="flex flex-col items-center justify-center min-w-[56px] min-h-[44px] px-2 py-1 group"
            >
              <div
                className={`w-11 h-6 rounded-lg flex items-center justify-center transition-all duration-150 ${
                  isActive
                    ? 'bg-[#CCE8E1] dark:bg-[#004F46]'
                    : 'bg-transparent group-hover:bg-[#F1F5F4] dark:group-hover:bg-[#1E293B]'
                }`}
              >
                <Icon
                  className={`w-4 h-4 transition-colors ${
                    isActive
                      ? 'text-[#00695C] dark:text-[#80D5C4]'
                      : 'text-[#64748B] dark:text-[#94A3B8] group-hover:text-[#0F172A] dark:group-hover:text-[#F1F5F9]'
                  }`}
                />
              </div>
              <span
                className={`text-[10px] mt-0.5 leading-none transition-colors ${
                  isActive
                    ? 'font-semibold text-[#00695C] dark:text-[#80D5C4]'
                    : 'font-medium text-[#64748B] dark:text-[#94A3B8]'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
