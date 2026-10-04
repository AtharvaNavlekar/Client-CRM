import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { BottomNavBar } from './components/layout/BottomNavBar';
import { LeadsListView } from './components/leads/LeadsListView';
import { DashboardView } from './components/dashboard/DashboardView';
import { LeaderboardView } from './components/leaderboard/LeaderboardView';
import { GettingStartedView } from './components/home/GettingStartedView';
import { ReportsView } from './components/reports/ReportsView';
import { KanbanBoard } from './components/pipeline/KanbanBoard';
import { AddLeadModal } from './components/pipeline/AddLeadModal';
import { BulkImportModal } from './components/pipeline/BulkImportModal';
import { LeadDetailModal } from './components/pipeline/LeadDetailModal';
import { CallConsoleModal } from './components/calling/CallConsoleModal';
import { CallsView } from './components/calling/CallsView';
import { WhatsAppView } from './components/whatsapp/WhatsAppView';
import { SupportView } from './components/support/SupportView';
import { SettingsView } from './components/settings/SettingsView';
import { TrustComplianceView } from './components/compliance/TrustComplianceView';
import { ActivityLogsView } from './components/audit/ActivityLogsView';
import { LoginModal } from './components/auth/LoginModal';
import { Plus } from 'lucide-react';
import { Lead, Call, Message, LeadStage } from './types';
import { useAuth, AuthProvider, AuthContext } from './context/AuthContext';
import { ThemeProvider, ThemeContext } from './context/ThemeContext';
import { api, setAppSecurityLocked } from './services/api';
import { useIsMobile } from './utils/useBreakpoint';
import { useDevToolsDeterrence } from './utils/deterrence';
import { useAutomationDetection } from './utils/automationDetection';
import {
  DevToolsWarningOverlay,
  AutomationWarningBanner
} from './components/common/SecurityDeterrenceComponents';
import { ImpersonationBanner } from './components/common/ImpersonationBanner';

// ============================================================================
// SECURITY & UX DETERRENCE FEATURE FLAGS
// ============================================================================
export const ENABLE_DEVTOOLS_DETERRENCE = true;
export const ENABLE_AUTOMATION_DETECTION = true;

const AppContent: React.FC = () => {
  const { currentUser, users, isLoading, logout } = useAuth();

  // Feature 1 & 2 Security Deterrence Hooks
  const { isSecurityLocked, lockState } = useDevToolsDeterrence(ENABLE_DEVTOOLS_DETERRENCE, {
    consecutiveSamplesRequired: 3,
    consecutiveClearRequired: 3,
    sampleIntervalMs: 450,
    sessionTimeoutMs: 60000,
    onSessionTimeout: () => {
      // Secure logout when persistent lock state exceeds timeout threshold
      logout();
    }
  });
  const { isAutomated: isAutomatedBrowser, detectionReasons, dismissWarning: dismissAutomationWarning } = useAutomationDetection(ENABLE_AUTOMATION_DETECTION);

  // Synchronize security lock state with API service & dispatch telemetry event
  const hasLoggedSecurityEventRef = useRef(false);
  useEffect(() => {
    setAppSecurityLocked(isSecurityLocked);
    if (isSecurityLocked && !hasLoggedSecurityEventRef.current) {
      hasLoggedSecurityEventRef.current = true;
      api.logSecurityEvent({
        eventType: 'CLIENT_DEVTOOLS_RESTRICTION_TRIGGERED',
        detectionCategory: 'devtools_restriction',
        metadata: {
          timestamp: new Date().toISOString()
        }
      });
    } else if (!isSecurityLocked) {
      hasLoggedSecurityEventRef.current = false;
    }
  }, [isSecurityLocked]);

  // When SECURITY_LOCKED becomes active, immediately collapse all modals and sensitive action drawers
  useEffect(() => {
    if (isSecurityLocked) {
      setIsAddLeadOpen(false);
      setIsBulkImportOpen(false);
      setSelectedLeadForDetail(null);
      setActiveCallingLead(null);
      setActiveChatLeadId(null);
      setIsMobileSidebarOpen(false);
    }
  }, [isSecurityLocked]);

  // Navigation state: defaults to 'leads'
  const [currentView, setCurrentView] = useState<string>('leads');

  // Real CRM State from backend APIs
  const [leads, setLeads] = useState<Lead[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Global Search state
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [selectedLeadForDetail, setSelectedLeadForDetail] = useState<Lead | null>(null);
  const [activeCallingLead, setActiveCallingLead] = useState<Lead | null>(null);
  const [activeChatLeadId, setActiveChatLeadId] = useState<string | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  // Real Data Fetcher
  const loadCrmData = useCallback(async () => {
    if (isSecurityLocked) {
      setIsLoadingData(false);
      setIsRefreshing(false);
      return;
    }
    setIsLoadingData(true);
    setDataError(null);
    try {
      const [fetchedLeads, fetchedCalls, fetchedMessages] = await Promise.all([
        api.getLeads().catch(() => []),
        api.getCalls().catch(() => []),
        api.getMessages().catch(() => [])
      ]);
      setLeads(fetchedLeads);
      setCalls(fetchedCalls);
      setMessages(fetchedMessages || []);
    } catch (err: any) {
      console.error('Failed to load CRM data:', err);
      setDataError(err?.message || 'Failed to fetch CRM records from database');
    } finally {
      setIsLoadingData(false);
      setIsRefreshing(false);
    }
  }, [isSecurityLocked]);

  // Fetch when authenticated user is available and not locked
  useEffect(() => {
    if (currentUser && !isSecurityLocked) {
      loadCrmData();
    }
  }, [currentUser, isSecurityLocked, loadCrmData]);

  // Refresh handler
  const handleRefreshAll = () => {
    if (isSecurityLocked) return;
    setIsRefreshing(true);
    loadCrmData();
  };

  // Handler: Single Lead update (persisted via API)
  const handleUpdateLead = async (updated: Lead) => {
    if (isSecurityLocked) return;
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    if (selectedLeadForDetail?.id === updated.id) {
      setSelectedLeadForDetail(updated);
    }
    try {
      await api.updateLead(updated.id, updated);
    } catch (err) {
      console.error('Failed to persist lead update:', err);
    }
  };

  // Handler: Bulk update leads (persisted via API)
  const handleBulkUpdate = async (leadIds: string[], updates: Partial<Lead>) => {
    if (isSecurityLocked) return;
    const idSet = new Set(leadIds);
    setLeads((prev) =>
      prev.map((l) => (idSet.has(l.id) ? { ...l, ...updates } : l))
    );
    try {
      await api.bulkUpdateLeads(leadIds, updates);
    } catch (err) {
      console.error('Failed to persist bulk update:', err);
    }
  };

  // Handler: Start Call simulation
  const handleStartCall = (lead: Lead) => {
    if (isSecurityLocked) return;
    setActiveCallingLead(lead);
  };

  // Handler: Open WhatsApp Chat
  const handleOpenWhatsApp = (lead: Lead) => {
    if (isSecurityLocked) return;
    setActiveChatLeadId(lead.id);
    setCurrentView('whatsapp');
  };

  // Handler: Select Lead for Detail Inspection Modal
  const handleSelectLeadForDetail = (lead: Lead) => {
    if (isSecurityLocked) return;
    setSelectedLeadForDetail(lead);
  };

  // Count callbacks due from real data
  const callbacksDueCount = leads.filter(
    (l) => l.callbackReminder || l.stage === 'Follow-up'
  ).length;

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-10 h-10 border-4 border-[#2E6E5C] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold tracking-wide uppercase text-slate-500 dark:text-slate-400">
            Initializing DialPulse Security Context...
          </p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <>
        <AutomationWarningBanner
          isVisible={isAutomatedBrowser}
          onDismiss={dismissAutomationWarning}
          reasons={detectionReasons}
        />
        <DevToolsWarningOverlay
          isOpen={isSecurityLocked}
        />
        <LoginModal />
      </>
    );
  }

  return (
    <div
      className="flex h-screen w-screen overflow-hidden bg-[#F8FAF9] dark:bg-[#111514] font-body text-[#0F172A] dark:text-[#F1F5F9] antialiased selection:bg-[#00695C] selection:text-white relative"
    >
      {/* DevTools Deterrence Full-Screen Opaque Security Lock Screen */}
      <DevToolsWarningOverlay
        isOpen={isSecurityLocked}
      />

      {/* Main CRM Application Content: Inert and obscured when SECURITY_LOCKED */}
      <div
        className="flex h-full w-full overflow-hidden"
        inert={isSecurityLocked ? true : undefined}
        aria-hidden={isSecurityLocked ? true : undefined}
      >
        {/* Icon-only Collapsible Left Sidebar */}
        <Sidebar
          currentView={currentView}
          onViewChange={(view) => {
            if (!isSecurityLocked) setCurrentView(view);
          }}
          isOpenMobile={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          callbacksDueCount={callbacksDueCount}
          openTicketsCount={1}
          leadsCount={leads.length}
        />

      {/* Main Content Viewport */}
      <div className="flex flex-col flex-1 h-full min-w-0 overflow-hidden">
        {/* Client-Side Automation Heuristic Warning Banner */}
        <AutomationWarningBanner
          isVisible={isAutomatedBrowser}
          onDismiss={dismissAutomationWarning}
          reasons={detectionReasons}
        />

        {/* Fixed Top Bar */}
        <TopBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onOpenAddLead={() => setIsAddLeadOpen(true)}
          onOpenBulkImport={() => setIsBulkImportOpen(true)}
          onQuickCall={() => {
            if (leads.length > 0) handleStartCall(leads[0]);
          }}
          onRefreshData={handleRefreshAll}
          isRefreshing={isRefreshing}
        />

        <ImpersonationBanner />

        {/* View Router */}
        <main className="flex-1 overflow-hidden relative flex flex-col">
          {/* SCREEN 1: Leads List View */}
          {currentView === 'leads' && (
            <LeadsListView
              leads={leads}
              users={users}
              isLoading={isLoadingData}
              isRefreshing={isRefreshing}
              error={dataError}
              onRefresh={handleRefreshAll}
              onUpdateLead={handleUpdateLead}
              onBulkUpdate={handleBulkUpdate}
              onInitiateCall={handleStartCall}
              onOpenChat={handleOpenWhatsApp}
              onSelectLead={handleSelectLeadForDetail}
              onOpenAddLead={() => setIsAddLeadOpen(true)}
              onOpenImport={() => setIsBulkImportOpen(true)}
            />
          )}

          {/* SCREEN 2: Dashboard (Home/Reporting View) */}
          {currentView === 'dashboard' && (
            <DashboardView
              leads={leads}
              calls={calls}
              messages={messages}
              isLoading={isLoadingData}
              isRefreshing={isRefreshing}
              error={dataError}
              onRefresh={handleRefreshAll}
              onNavigateToLeadsFilter={(filterName) => {
                setCurrentView('leads');
              }}
              onNavigateToStage={(stage) => {
                setCurrentView('leads');
              }}
              onNavigateToCalls={() => {
                setCurrentView('calls');
              }}
              onOpenAddLead={() => setIsAddLeadOpen(true)}
              onSelectLead={handleSelectLeadForDetail}
              onStartCall={handleStartCall}
            />
          )}

          {/* SCREEN 3: Leaderboard */}
          {currentView === 'leaderboard' && <LeaderboardView />}

          {/* SCREEN 4: Home / Getting Started */}
          {currentView === 'home' && (
            <GettingStartedView
              onNavigateToLeads={() => setCurrentView('leads')}
              onNavigateToDashboard={() => setCurrentView('dashboard')}
              onNavigateToLeaderboard={() => setCurrentView('leaderboard')}
            />
          )}

          {/* Supplementary CRM Views */}
          {currentView === 'pipeline' && (
            <div className="p-4 flex-1 overflow-y-auto">
              <KanbanBoard
                leads={leads}
                users={users}
                onUpdateStage={(leadId, stage) => {
                  setLeads((prev) =>
                    prev.map((l) => (l.id === leadId ? { ...l, stage } : l))
                  );
                  api.updateLead(leadId, { stage }).catch((err) => console.error(err));
                }}
                onSelectLead={(lead) => setSelectedLeadForDetail(lead)}
                onOpenDetail={(lead) => setSelectedLeadForDetail(lead)}
                onStartCall={handleStartCall}
                onOpenWhatsApp={handleOpenWhatsApp}
                onAssignRep={(leadId, repId) => {
                  const rep = users.find((u) => u.id === repId);
                  if (rep) {
                    setLeads((prev) =>
                      prev.map((l) => (l.id === leadId ? { ...l, assignedRepId: rep.id, assignedRepName: rep.name } : l))
                    );
                    api.updateLead(leadId, { assignedRepId: rep.id, assignedRepName: rep.name }).catch((err) => console.error(err));
                  }
                }}
                onOpenAddLead={() => setIsAddLeadOpen(true)}
                onOpenBulkImport={() => setIsBulkImportOpen(true)}
                onBulkUpdate={(ids, updates) => {
                  handleBulkUpdate(ids, updates);
                }}
              />
            </div>
          )}

          {currentView === 'calls' && (
            <div className="p-4 flex-1 overflow-y-auto">
              <CallsView
                calls={calls}
                leads={leads}
                users={users}
                onStartCall={handleStartCall}
                onOpenWhatsApp={handleOpenWhatsApp}
                onOpenDetail={(lead) => setSelectedLeadForDetail(lead)}
              />
            </div>
          )}

          {currentView === 'whatsapp' && (
            <div className="flex-1 overflow-hidden">
              <WhatsAppView
                leads={leads}
                selectedLeadId={activeChatLeadId}
                onSelectLead={setActiveChatLeadId}
                onStartCall={handleStartCall}
                onOpenDetail={(lead) => setSelectedLeadForDetail(lead)}
              />
            </div>
          )}

          {currentView === 'support' && (
            <div className="p-4 flex-1 overflow-y-auto">
              <SupportView leads={leads} users={users} />
            </div>
          )}

          {currentView === 'compliance' && (
            <div className="flex-1 overflow-hidden">
              <TrustComplianceView />
            </div>
          )}

          {currentView === 'activity' && (
            <div className="flex-1 overflow-hidden">
              <ActivityLogsView />
            </div>
          )}

          {currentView === 'settings' && (
            <div className="p-4 flex-1 overflow-y-auto">
              <SettingsView onDataReset={handleRefreshAll} />
            </div>
          )}

          {currentView === 'reports' && (
            <div className="p-4 flex-1 overflow-y-auto">
              <ReportsView />
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      <AddLeadModal
        isOpen={isAddLeadOpen}
        onClose={() => setIsAddLeadOpen(false)}
        onLeadAdded={(newLead) => {
          setLeads((prev) => [newLead, ...prev]);
        }}
        users={users}
      />

      <BulkImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        onImportComplete={(imported) => {
          setLeads((prev) => [...imported, ...prev]);
        }}
        users={users}
      />

      <LeadDetailModal
        lead={selectedLeadForDetail}
        onClose={() => setSelectedLeadForDetail(null)}
        onStartCall={handleStartCall}
        onOpenWhatsApp={handleOpenWhatsApp}
        onUpdateStage={(leadId, stage) => {
          handleUpdateLead({
            ...(selectedLeadForDetail as Lead),
            stage
          });
        }}
        onAssignRep={(leadId, repId) => {
          const rep = users.find((u) => u.id === repId);
          if (rep) {
            handleUpdateLead({
              ...(selectedLeadForDetail as Lead),
              assignedRepId: rep.id,
              assignedRepName: rep.name
            });
          }
        }}
        onUpdateLead={(updated) => {
          handleUpdateLead(updated);
        }}
        users={users}
      />

      <CallConsoleModal
        isOpen={Boolean(activeCallingLead)}
        lead={activeCallingLead}
        currentUser={currentUser}
        onClose={() => setActiveCallingLead(null)}
        onCallLogged={(callData) => {
          const newCall: Call = {
            id: `call-${Date.now()}`,
            leadId: callData.leadId,
            leadName: activeCallingLead?.name || 'Lead',
            leadPhone: activeCallingLead?.phone || '',
            repId: currentUser?.id || 'u1',
            repName: currentUser?.name || 'Aakash Verma',
            timestamp: new Date().toISOString(),
            duration: callData.duration,
            outcome: callData.outcome,
            notes: callData.notes,
            recordingSimulated: true
          };
          setCalls((prev) => [newCall, ...prev]);

          if (activeCallingLead && callData.outcome) {
            let nextStage: LeadStage = activeCallingLead.stage;
            if (callData.outcome === 'Converted') nextStage = 'Won';
            else if (callData.outcome === 'Not Interested') nextStage = 'Lost';
            else if (callData.outcome === 'Call Back Later') nextStage = 'Follow-up';
            else if (activeCallingLead.stage === 'New') nextStage = 'Contacted';

            handleUpdateLead({
              ...activeCallingLead,
              stage: nextStage
            });
          }
        }}
      />

      {/* Mobile Bottom Navigation Bar */}
      {isMobile && (
        <BottomNavBar
          currentView={currentView}
          onViewChange={setCurrentView}
          onAddLead={() => setIsAddLeadOpen(true)}
        />
      )}

      {/* Material Design 3 Extended Floating Action Button (FAB) — desktop only */}
      {!isMobile && (
        <div className="fixed bottom-6 right-6 z-40 flex items-center space-x-3">
          <button
            id="m3-fab-add-lead"
            type="button"
            onClick={() => setIsAddLeadOpen(true)}
            aria-label="Add new lead"
            className="m3-elevation-3 hover:m3-elevation-4 active:m3-elevation-2 flex items-center space-x-2.5 px-5 py-4 rounded-[24px] bg-[#00695C] text-white hover:bg-[#005449] active:scale-[0.98] transition-all duration-200 min-h-[56px]"
            title="Add New Lead"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
            <span className="text-sm font-medium tracking-wide pr-1">Add Lead</span>
          </button>
        </div>
      )}
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  const auth = React.useContext(AuthContext);
  const theme = React.useContext(ThemeContext);

  let content = <AppContent />;
  if (!auth) {
    content = <AuthProvider>{content}</AuthProvider>;
  }
  if (!theme) {
    content = <ThemeProvider>{content}</ThemeProvider>;
  }

  return content;
};

export default App;
