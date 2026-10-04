import React, { useState } from 'react';
import {
  Compass,
  Table,
  Kanban,
  PhoneCall,
  MessageSquare,
  LayoutDashboard,
  Trophy,
  LifeBuoy,
  Activity,
  ShieldCheck,
  Settings,
  ChevronLeft,
  ChevronRight,
  Phone,
  X,
  BarChart3
} from 'lucide-react';
import { useAuth, usePolicy } from '../../context/AuthContext';
import { StatusBadge } from '../ui/Badge';

export type NavView =
  | 'home'
  | 'leads'
  | 'dashboard'
  | 'leaderboard'
  | 'pipeline'
  | 'compliance'
  | 'calls'
  | 'whatsapp'
  | 'support'
  | 'activity'
  | 'reports'
  | 'settings';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: any) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  callbacksDueCount?: number;
  openTicketsCount?: number;
  leadsCount?: number;
}

interface NavItemConfig {
  id: NavView;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeText?: string | null;
  badgeTone?: 'primary' | 'warning' | 'error' | 'success' | 'info' | 'neutral';
  desc: string;
}

interface NavSection {
  title: string;
  pillar?: string;
  items: NavItemConfig[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onViewChange,
  isOpenMobile = false,
  onCloseMobile = () => {},
  callbacksDueCount = 0,
  openTicketsCount = 0,
  leadsCount = 0
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { currentUser } = useAuth();
  const { can } = usePolicy();

  const handleSelect = (viewId: NavView) => {
    onViewChange(viewId);
    onCloseMobile();
  };

  // Structured for the primary Client-Facing CRM experience
  const sections: NavSection[] = [
    {
      title: 'Workspace',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          shortLabel: 'Dash',
          icon: LayoutDashboard,
          desc: 'Operational KPI telemetry & funnels'
        },
        {
          id: 'home',
          label: 'Getting Started',
          shortLabel: 'Start',
          icon: Compass,
          desc: 'Onboarding & quick setups'
        }
      ]
    },
    {
      title: 'Capture',
      items: [
        {
          id: 'leads',
          label: 'Leads',
          shortLabel: 'Leads',
          icon: Table,
          badgeText: leadsCount > 0 ? `${leadsCount}` : null,
          badgeTone: 'neutral',
          desc: 'Manage leads & ownership'
        },
        {
          id: 'pipeline',
          label: 'Pipeline',
          shortLabel: 'Pipeline',
          icon: Kanban,
          desc: 'Kanban sales workflow'
        }
      ]
    },
    {
      title: 'Communicate',
      items: [
        {
          id: 'calls',
          label: 'Calls',
          shortLabel: 'Calls',
          icon: PhoneCall,
          badgeText: callbacksDueCount > 0 ? `${callbacksDueCount} due` : null,
          badgeTone: callbacksDueCount > 0 ? 'warning' : undefined,
          desc: 'Dialer & callback reminders'
        },
        {
          id: 'whatsapp',
          label: 'Messages',
          shortLabel: 'Messages',
          icon: MessageSquare,
          badgeText: 'Official API',
          badgeTone: 'primary',
          desc: 'WhatsApp WACA Cloud inbox'
        }
      ]
    },
    {
      title: 'Operate',
      items: [
        {
          id: 'reports',
          label: 'Reports',
          shortLabel: 'Reports',
          icon: BarChart3,
          desc: 'Team telecalling & conversion reports'
        },
        {
          id: 'leaderboard',
          label: 'Leaderboard',
          shortLabel: 'Ranks',
          icon: Trophy,
          desc: 'Rep rankings & quotas'
        },
        {
          id: 'support',
          label: 'Support',
          shortLabel: 'Support',
          icon: LifeBuoy,
          badgeText: openTicketsCount > 0 ? `${openTicketsCount}` : null,
          badgeTone: openTicketsCount > 0 ? 'error' : undefined,
          desc: 'Help & ticket escalations'
        }
      ]
    },
    {
      title: 'Protect',
      items: [
        {
          id: 'compliance',
          label: 'Compliance',
          shortLabel: 'Trust',
          icon: ShieldCheck,
          badgeText: 'Active',
          badgeTone: 'success',
          desc: 'Fatigue guard & DND quiet hours'
        },
        {
          id: 'activity',
          label: 'Activity / Audit',
          shortLabel: 'Audit',
          icon: Activity,
          desc: 'Security & mutation trail'
        }
      ]
    },
    {
      title: 'Workspace Settings',
      items: [
        {
          id: 'settings',
          label: 'Settings',
          shortLabel: 'Settings',
          icon: Settings,
          desc: 'Teams, RBAC policies & workspace setup'
        }
      ]
    }
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-xs transition-opacity duration-200"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Main Material 3 Application Navigation Sidebar */}
      <aside
        id="app-sidebar"
        role="navigation"
        aria-label="Main CRM Navigation"
        className={`fixed lg:static top-0 bottom-0 left-0 z-50 shrink-0 bg-[#FFFFFF] dark:bg-[#111514] text-[#0F172A] dark:text-[#F1F5F9] flex flex-col transition-all duration-200 ease-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${
          isCollapsed ? 'w-20' : 'w-64'
        } border-r border-[#E2E8F0] dark:border-[#334155] shadow-xs lg:shadow-none h-screen select-none font-body`}
      >
        {/* Brand & Organization Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#111514] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {/* Primary DialPulse Emblem */}
            <div className="w-9 h-9 rounded-full bg-[#00695C] dark:bg-[#80D5C4] flex items-center justify-center text-white dark:text-[#003830] shadow-xs shrink-0">
              <Phone className="w-4 h-4 text-current" />
            </div>

            {!isCollapsed && (
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-base font-heading tracking-tight text-[#0F172A] dark:text-[#F1F5F9] truncate">
                    DialPulse
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#CCE8E1] dark:bg-[#004F46] text-[#00201B] dark:text-[#A3F2E4] uppercase">
                    CRM
                  </span>
                </div>
                <p className="text-[11px] text-[#475569] dark:text-[#94A3B8] truncate leading-tight">
                  Telecalling &amp; WhatsApp
                </p>
              </div>
            )}
          </div>

          {/* Mobile Close Button */}
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation sidebar"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#475569] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#F1F5F9] hover:bg-[#F1F5F4] dark:hover:bg-[#1E293B] lg:hidden"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Collapsible Pillar Navigation Modules */}
        <div className="flex-1 px-3 py-3 overflow-y-auto space-y-4">
          {sections.map((sec, secIdx) => (
            <div key={sec.title} className="space-y-1">
              {!isCollapsed ? (
                <div className="px-2 pt-1 pb-1 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#475569] dark:text-[#94A3B8]">
                    {sec.title}
                  </span>
                  {sec.pillar && (
                    <span className="text-[9px] font-mono text-[#94A3B8] dark:text-[#64748B]">
                      {sec.pillar}
                    </span>
                  )}
                </div>
              ) : (
                secIdx > 0 && (
                  <div className="my-2 border-t border-[#E2E8F0] dark:border-[#334155]" />
                )
              )}

              <div className="space-y-0.5">
                {sec.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentView === item.id;

                  return (
                    <button
                      key={item.id}
                      id={`sidebar-nav-${item.id}`}
                      type="button"
                      onClick={() => handleSelect(item.id)}
                      title={isCollapsed ? `${item.label} — ${item.desc}` : undefined}
                      aria-current={isActive ? 'page' : undefined}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-full text-xs font-medium transition-all group relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00695C] ${
                        isActive
                          ? 'bg-[#CCE8E1] text-[#00201B] font-semibold dark:bg-[#004F46] dark:text-[#A3F2E4]'
                          : 'text-[#475569] dark:text-[#94A3B8] hover:bg-[#F1F5F4] dark:hover:bg-[#1E293B] hover:text-[#0F172A] dark:hover:text-[#F1F5F9]'
                      } ${isCollapsed ? 'justify-center px-0' : ''}`}
                    >
                      {/* Active Indicator Bar */}
                      {isActive && (
                        <div
                          className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-4 bg-[#00695C] dark:bg-[#80D5C4] rounded-full"
                          aria-hidden="true"
                        />
                      )}

                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive
                            ? 'text-[#00695C] dark:text-[#80D5C4]'
                            : 'text-[#475569] dark:text-[#94A3B8] group-hover:text-[#0F172A] dark:group-hover:text-[#F1F5F9]'
                        }`}
                      />

                      {!isCollapsed && (
                        <div className="flex-1 flex items-center justify-between min-w-0">
                          <span className="truncate">{item.label}</span>
                          {item.badgeText && (
                            <StatusBadge
                              status={item.badgeText}
                              tone={item.badgeTone || 'neutral'}
                              showDot={false}
                              size="sm"
                              className="ml-1.5"
                            />
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar Footer with Collapse Rail Toggle */}
        <div className="p-3 border-t border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAF9] dark:bg-[#111514] shrink-0">
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label={isCollapsed ? 'Expand navigation sidebar' : 'Collapse navigation sidebar'}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-full text-xs font-medium text-[#475569] dark:text-[#94A3B8] hover:bg-[#E2E8F0] dark:hover:bg-[#1E293B] hover:text-[#0F172A] dark:hover:text-[#F1F5F9] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00695C]"
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span>Collapse Sidebar</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
};
