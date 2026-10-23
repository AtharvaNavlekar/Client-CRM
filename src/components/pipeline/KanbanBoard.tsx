import React, { useState, useEffect } from 'react';
import { MaterialDropdown } from '../common/MaterialDropdown';
import {
  Kanban,
  Table as TableIcon,
  Filter,
  Plus,
  Upload,
  User,
  Zap,
  CheckSquare,
  Square,
  Search,
  Phone,
  MessageSquare,
  Clock,
  ArrowRight,
  TrendingUp,
  DollarSign,
  Briefcase,
  AlertCircle
} from 'lucide-react';
import { Lead, LeadStage, LeadSource, User as UserType } from '../../types';
import { LeadCard } from './LeadCard';
import { useAuth, usePolicy } from '../../context/AuthContext';
import { api } from '../../services/api';

interface KanbanBoardProps {
  leads: Lead[];
  users?: UserType[];
  onOpenDetail?: (lead: Lead) => void;
  onSelectLead?: (lead: Lead) => void;
  onStartCall: (lead: Lead) => void;
  onOpenWhatsApp: (lead: Lead) => void;
  onUpdateStage: (leadId: string, newStage: LeadStage) => void;
  onAssignRep?: (leadId: string, repId: string) => void;
  onOpenAddLead?: () => void;
  onOpenBulkImport?: () => void;
  onBulkUpdate?: (leadIds: string[], updates: { stage?: LeadStage; assignedRepId?: string }) => Promise<void> | void;
  selectedSource?: string;
  setSelectedSource?: (s: string) => void;
  selectedRep?: string;
  setSelectedRep?: (r: string) => void;
}

const STAGES: { id: LeadStage; title: string; color: string; border: string; dotBg: string; badgeBg: string }[] = [
  { id: 'New', title: 'New Leads', color: 'text-sky-700 dark:text-sky-300', border: 'border-sky-300 dark:border-sky-800', dotBg: 'bg-sky-500', badgeBg: 'bg-sky-50 dark:bg-sky-950/60' },
  { id: 'Contacted', title: 'Contacted', color: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-300 dark:border-indigo-800', dotBg: 'bg-indigo-500', badgeBg: 'bg-indigo-50 dark:bg-indigo-950/60' },
  { id: 'Follow-up', title: 'Follow-up Due', color: 'text-amber-700 dark:text-amber-300', border: 'border-amber-300 dark:border-amber-800', dotBg: 'bg-amber-500', badgeBg: 'bg-amber-50 dark:bg-amber-950/60' },
  { id: 'Negotiation', title: 'Negotiation', color: 'text-purple-700 dark:text-purple-300', border: 'border-purple-300 dark:border-purple-800', dotBg: 'bg-purple-500', badgeBg: 'bg-purple-50 dark:bg-purple-950/60' },
  { id: 'Won', title: 'Won Closed', color: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-300 dark:border-emerald-800', dotBg: 'bg-emerald-500', badgeBg: 'bg-emerald-50 dark:bg-emerald-950/60' },
  { id: 'Lost', title: 'Lost / Dropped', color: 'text-rose-700 dark:text-rose-300', border: 'border-rose-300 dark:border-rose-800', dotBg: 'bg-rose-500', badgeBg: 'bg-rose-50 dark:bg-rose-950/60' }
];

const SOURCES: LeadSource[] = ['Website', 'WhatsApp', 'Facebook', 'Google Ads', 'IndiaMART', 'Manual'];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  leads,
  users = [],
  onOpenDetail,
  onSelectLead,
  onStartCall,
  onOpenWhatsApp,
  onUpdateStage,
  onAssignRep = (_leadId: string, _repId: string) => {},
  onOpenAddLead,
  onOpenBulkImport,
  onBulkUpdate,
  selectedSource,
  setSelectedSource,
  selectedRep,
  setSelectedRep
}) => {
  const { currentUser, users: authUsers } = useAuth();
  const { can } = usePolicy();
  const effectiveUsers = users && users.length > 0 ? users : authUsers;
  const handleOpenDetail = onOpenDetail || onSelectLead || (() => {});

  // View Mode: 'board' (Kanban) or 'table' (Structured List)
  const [viewMode, setViewMode] = useState<'board' | 'table'>('board');

  // Search filter
  const [searchFilter, setSearchFilter] = useState('');

  // Source & Rep Filters
  const [internalSource, setInternalSource] = useState('all');
  const [internalRep, setInternalRep] = useState('all');
  const [stageFilter, setStageFilter] = useState<string>('all');

  const currentSource = selectedSource !== undefined ? selectedSource : internalSource;
  const currentRep = selectedRep !== undefined ? selectedRep : internalRep;
  const handleSourceChange = setSelectedSource || setInternalSource;
  const handleRepChange = setSelectedRep || setInternalRep;

  // Drag and Drop
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<LeadStage | null>(null);

  // Bulk Edit
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [isBulkMode, setIsBulkMode] = useState<boolean>(false);
  const [bulkStage, setBulkStage] = useState<LeadStage | ''>('');
  const [bulkRepId, setBulkRepId] = useState<string>('');
  const [isApplyingBulk, setIsApplyingBulk] = useState<boolean>(false);
  const [autoAssignmentEnabled, setAutoAssignmentEnabled] = useState<boolean>(true);
  const [isTogglingAutoAssign, setIsTogglingAutoAssign] = useState<boolean>(false);

  useEffect(() => {
    api.getSettings()
      .then((s) => {
        if (s && typeof s.autoAssignmentEnabled === 'boolean') {
          setAutoAssignmentEnabled(s.autoAssignmentEnabled);
        }
      })
      .catch((err) => console.error('Failed to load auto-assign setting:', err));
  }, []);

  const handleToggleAutoAssign = async () => {
    const nextVal = !autoAssignmentEnabled;
    setIsTogglingAutoAssign(true);
    try {
      await api.toggleAutoAssignment(nextVal);
      setAutoAssignmentEnabled(nextVal);
    } catch (err) {
      console.error('Failed to toggle auto-assignment:', err);
    } finally {
      setIsTogglingAutoAssign(false);
    }
  };

  const handleToggleSelectLead = (leadId: string) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) {
        next.delete(leadId);
      } else {
        next.add(leadId);
      }
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    if (selectedLeadIds.size === filteredLeads.length) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(filteredLeads.map((l) => l.id)));
    }
  };

  const handleApplyBulkUpdates = async () => {
    if (selectedLeadIds.size === 0) return;
    const ids: string[] = Array.from(selectedLeadIds);
    const updates: { stage?: LeadStage; assignedRepId?: string } = {};
    if (bulkStage) updates.stage = bulkStage;
    if (bulkRepId) updates.assignedRepId = bulkRepId;

    if (!updates.stage && !updates.assignedRepId) return;

    setIsApplyingBulk(true);
    try {
      if (onBulkUpdate) {
        await onBulkUpdate(ids, updates);
      } else {
        await api.bulkUpdateLeads(ids, updates);
      }
      setSelectedLeadIds(new Set());
      setBulkStage('');
      setBulkRepId('');
      setIsBulkMode(false);
    } catch (err) {
      console.error('Failed to apply bulk update:', err);
    } finally {
      setIsApplyingBulk(false);
    }
  };

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData('text/plain', leadId);
    setDraggedLeadId(leadId);
  };

  const handleDragOver = (e: React.DragEvent, stage: LeadStage) => {
    e.preventDefault();
    setDragOverStage(stage);
  };

  const handleDragLeave = () => {
    setDragOverStage(null);
  };

  const handleDrop = (e: React.DragEvent, targetStage: LeadStage) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('text/plain') || draggedLeadId;
    if (leadId) {
      onUpdateStage(leadId, targetStage);
    }
    setDraggedLeadId(null);
    setDragOverStage(null);
  };

  // Filter leads
  const filteredLeads = leads.filter((lead) => {
    if (currentSource !== 'all' && lead.source !== currentSource) return false;
    if (currentRep !== 'all' && lead.assignedRepId !== currentRep) return false;
    if (stageFilter !== 'all' && lead.stage !== stageFilter) return false;
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      const matchName = lead.name.toLowerCase().includes(q);
      const matchPhone = lead.phone.includes(q);
      const matchNotes = lead.notes?.toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchNotes) return false;
    }
    return true;
  });

  const getStageLeads = (stage: LeadStage) => {
    return filteredLeads.filter((lead) => lead.stage === stage);
  };

  const totalFilteredValue = filteredLeads.reduce((acc, curr) => acc + (curr.value || 0), 0);
  const activeFollowups = leads.filter((l) => l.stage === 'Follow-up').length;
  const inNegotiation = leads.filter((l) => l.stage === 'Negotiation').length;
  const wonClosed = leads.filter((l) => l.stage === 'Won').length;

  const formatCurrency = (amount: number) => {
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)} L`;
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* 1. Page Header & Key Metrics Strip */}
      <div className="bg-white dark:bg-[#161A19] rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-100 dark:border-slate-800/80">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Sales Pipeline
              </h1>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
                {filteredLeads.length} Deals
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Track and progress qualified customer opportunities from first contact to deal closure.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* View Mode Toggle: Board vs Table */}
            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              <button
                type="button"
                onClick={() => setViewMode('board')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  viewMode === 'board'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                title="Switch to Kanban Board View"
              >
                <Kanban className="w-3.5 h-3.5 text-emerald-600" />
                <span>Board</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                title="Switch to Structured Table View"
              >
                <TableIcon className="w-3.5 h-3.5 text-blue-600" />
                <span>Table</span>
              </button>
            </div>

            {/* Quick Actions */}
            {onOpenBulkImport && (
              <button
                type="button"
                onClick={onOpenBulkImport}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors"
              >
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                <span>Import</span>
              </button>
            )}

            {onOpenAddLead && (
              <button
                type="button"
                onClick={onOpenAddLead}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-xs active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" />
                <span>Add Lead</span>
              </button>
            )}
          </div>
        </div>

        {/* Metric Cards Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Pipeline Value</div>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums mt-0.5">
              {formatCurrency(totalFilteredValue)}
            </div>
            <div className="text-[10px] text-emerald-600 font-medium mt-0.5">
              Across {filteredLeads.length} active opportunities
            </div>
          </div>

          <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40">
            <div className="text-[11px] font-medium text-amber-800 dark:text-amber-300">Follow-ups Due</div>
            <div className="text-lg font-bold text-amber-900 dark:text-amber-100 font-mono tabular-nums mt-0.5">
              {activeFollowups} Leads
            </div>
            <div className="text-[10px] text-amber-700 dark:text-amber-400 font-medium mt-0.5">
              Pending client follow-up callbacks
            </div>
          </div>

          <div className="p-3 rounded-xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40">
            <div className="text-[11px] font-medium text-purple-800 dark:text-purple-300">In Negotiation</div>
            <div className="text-lg font-bold text-purple-900 dark:text-purple-100 font-mono tabular-nums mt-0.5">
              {inNegotiation} Deals
            </div>
            <div className="text-[10px] text-purple-700 dark:text-purple-400 font-medium mt-0.5">
              Final terms & quotation stage
            </div>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40">
            <div className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300">Won / Closed</div>
            <div className="text-lg font-bold text-emerald-900 dark:text-emerald-100 font-mono tabular-nums mt-0.5">
              {wonClosed} Converted
            </div>
            <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium mt-0.5">
              Successfully closed revenue
            </div>
          </div>
        </div>
      </div>

      {/* 2. Unified Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#161A19] p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search leads, phone..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-colors"
            />
            {searchFilter && (
              <button
                type="button"
                onClick={() => setSearchFilter('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Source Dropdown */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <MaterialDropdown
              id="filter-source-select"
              label="Source:"
              value={currentSource}
              ariaLabel="Filter leads by acquisition source"
              onChange={(val) => handleSourceChange(val)}
              variant="chip"
              options={[
                { value: 'all', label: `All Sources (${leads.length})` },
                ...SOURCES.map((s) => ({ value: s, label: s })),
              ]}
            />
          </div>

          {/* Rep Dropdown */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <MaterialDropdown
              id="filter-rep-select"
              label="Rep:"
              value={currentRep}
              ariaLabel="Filter leads by sales rep"
              onChange={(val) => handleRepChange(val)}
              variant="chip"
              options={[
                { value: 'all', label: 'All Team Reps' },
                ...effectiveUsers.map((u) => ({ value: u.id, label: `${u.name} (${u.role})` })),
              ]}
            />
          </div>

          {/* Stage Dropdown (Active in Table Mode or as Filter) */}
          {viewMode === 'table' && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
              <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <MaterialDropdown
                id="filter-stage-select"
                label="Stage:"
                value={stageFilter}
                ariaLabel="Filter leads by stage"
                onChange={(val) => setStageFilter(val)}
                variant="chip"
                options={[
                  { value: 'all', label: 'All Stages' },
                  ...STAGES.map((s) => ({ value: s.id, label: s.title })),
                ]}
              />
            </div>
          )}
        </div>

        {/* Right Utility Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Auto-Assign Switch */}
          {can('users:create') && (
            <button
              id="btn-toggle-auto-assign"
              type="button"
              onClick={handleToggleAutoAssign}
              disabled={isTogglingAutoAssign}
              aria-label={`Toggle auto-assignment round-robin`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                autoAssignmentEnabled
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                  : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
              }`}
              title="Round-robin distribution of incoming leads to sales reps"
            >
              <Zap className={`w-3.5 h-3.5 ${autoAssignmentEnabled ? 'text-emerald-600 fill-emerald-600' : 'text-slate-400'}`} />
              <span>Auto-Assign: {autoAssignmentEnabled ? 'ON' : 'OFF'}</span>
            </button>
          )}

          {/* Bulk Select Button */}
          {can('leads:update') && (
            <button
              id="btn-toggle-bulk-mode"
              type="button"
              onClick={() => {
                const nextMode = !isBulkMode;
                setIsBulkMode(nextMode);
                if (!nextMode) setSelectedLeadIds(new Set());
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                isBulkMode || selectedLeadIds.size > 0
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>{isBulkMode ? 'Exit Selection' : 'Bulk Select'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Main View Area: Board or Table */}
      {viewMode === 'board' ? (
        /* KANBAN BOARD VIEW */
        <div className="flex-1 overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max h-full items-start">
            {STAGES.map((stage) => {
              const stageLeads = getStageLeads(stage.id);
              const stageValue = stageLeads.reduce((acc, curr) => acc + (curr.value || 0), 0);
              const isTarget = dragOverStage === stage.id;

              return (
                <div
                  key={stage.id}
                  id={`kanban-column-${stage.id.toLowerCase().replace(' ', '-')}`}
                  role="region"
                  aria-label={`${stage.title} column, ${stageLeads.length} leads`}
                  onDragOver={(e) => handleDragOver(e, stage.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, stage.id)}
                  className={`w-[300px] shrink-0 flex flex-col bg-slate-50/70 dark:bg-[#141817] rounded-2xl border transition-all duration-150 p-3 min-h-[580px] ${
                    isTarget
                      ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-950/20'
                      : 'border-slate-200/80 dark:border-slate-800'
                  }`}
                >
                  {/* Stage Column Header */}
                  <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-200/60 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${stage.dotBg}`} aria-hidden="true" />
                      <h3 className="font-semibold text-xs text-slate-900 dark:text-slate-100 tracking-tight">
                        {stage.title}
                      </h3>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 tabular-nums">
                        {stageLeads.length}
                      </span>
                    </div>

                    {stageValue > 0 && (
                      <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
                        {formatCurrency(stageValue)}
                      </span>
                    )}
                  </div>

                  {/* Cards Container */}
                  <div className="flex-1 space-y-3 overflow-y-auto pr-0.5">
                    {stageLeads.map((lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        users={effectiveUsers}
                        onOpenDetail={handleOpenDetail}
                        onStartCall={onStartCall}
                        onOpenWhatsApp={onOpenWhatsApp}
                        onUpdateStage={onUpdateStage}
                        onAssignRep={onAssignRep}
                        onDragStart={handleDragStart}
                        isSelected={selectedLeadIds.has(lead.id)}
                        onToggleSelect={handleToggleSelectLead}
                        isSelectMode={isBulkMode || selectedLeadIds.size > 0}
                      />
                    ))}

                    {stageLeads.length === 0 && (
                      <div className="h-36 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl flex flex-col items-center justify-center p-3 text-center text-slate-400 dark:text-slate-500">
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-300">No leads in this stage</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Drag & drop leads here to progress</p>
                        {onOpenAddLead && (
                          <button
                            type="button"
                            onClick={onOpenAddLead}
                            className="mt-2.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Lead</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* STRUCTURED TABLE VIEW */
        <div className="bg-white dark:bg-[#161A19] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      aria-label="Select all leads"
                      checked={selectedLeadIds.size === filteredLeads.length && filteredLeads.length > 0}
                      onChange={handleSelectAllFiltered}
                      className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-4">Lead Contact</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4">Stage</th>
                  <th className="py-3 px-4">Assigned Rep</th>
                  <th className="py-3 px-4 text-right">Deal Value</th>
                  <th className="py-3 px-4">Latest Notes</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredLeads.map((lead) => {
                  const currentStageConfig = STAGES.find((s) => s.id === lead.stage);
                  const isSelected = selectedLeadIds.has(lead.id);

                  return (
                    <tr
                      key={lead.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors ${
                        isSelected ? 'bg-emerald-50/30 dark:bg-emerald-950/20' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectLead(lead.id)}
                          aria-label={`Select ${lead.name}`}
                          className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer"
                        />
                      </td>

                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(lead)}
                          className="text-left font-semibold text-slate-900 dark:text-slate-100 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                        >
                          {lead.name}
                        </button>
                        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                          {lead.phone}
                        </div>
                        {lead.industry && (
                          <div className="text-[10px] text-slate-400 dark:text-slate-500">
                            {lead.industry}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {lead.source}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <MaterialDropdown
                          id={`table-stage-${lead.id}`}
                          value={lead.stage}
                          ariaLabel={`Update stage for ${lead.name}`}
                          onChange={(val) => onUpdateStage(lead.id, val as LeadStage)}
                          variant="chip"
                          triggerClassName="text-xs font-medium"
                          options={STAGES.map((s) => ({ value: s.id, label: s.title }))}
                        />
                      </td>

                      <td className="py-3 px-4">
                        <MaterialDropdown
                          id={`table-rep-${lead.id}`}
                          value={lead.assignedRepId}
                          ariaLabel={`Assign rep for ${lead.name}`}
                          onChange={(val) => onAssignRep(lead.id, val)}
                          variant="chip"
                          triggerClassName="text-xs"
                          options={effectiveUsers.map((u) => ({ value: u.id, label: `${u.name} (${u.role})` }))}
                        />
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                        {lead.value ? formatCurrency(lead.value) : '—'}
                      </td>

                      <td className="py-3 px-4 max-w-xs truncate text-slate-500 dark:text-slate-400 text-[11px]" title={lead.notes}>
                        {lead.notes || '—'}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onStartCall(lead)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                            title={`Call ${lead.name}`}
                          >
                            <Phone className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenWhatsApp(lead)}
                            className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 transition-colors"
                            title={`WhatsApp ${lead.name}`}
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(lead)}
                            className="px-2 py-1 rounded-lg text-[11px] font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredLeads.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      <p className="text-sm font-medium">No leads match the selected filter criteria</p>
                      <button
                        type="button"
                        onClick={() => {
                          handleSourceChange('all');
                          handleRepChange('all');
                          setStageFilter('all');
                          setSearchFilter('');
                        }}
                        className="mt-2 text-xs text-emerald-600 hover:underline"
                      >
                        Reset all filters
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Floating Bulk Action Bar */}
      {(selectedLeadIds.size > 0 || isBulkMode) && (
        <div
          id="bulk-edit-bar"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 dark:bg-slate-800 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 flex flex-wrap items-center gap-3 max-w-[95vw] sm:max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          <button
            type="button"
            onClick={handleSelectAllFiltered}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium transition-colors"
          >
            {selectedLeadIds.size === filteredLeads.length && filteredLeads.length > 0 ? (
              <CheckSquare className="w-4 h-4 text-emerald-400" />
            ) : (
              <Square className="w-4 h-4 text-slate-400" />
            )}
            <span>
              {selectedLeadIds.size === filteredLeads.length ? 'Deselect All' : `Select All (${filteredLeads.length})`}
            </span>
          </button>

          <span className="text-xs text-slate-300">
            <strong className="text-white font-semibold">{selectedLeadIds.size}</strong> selected
          </span>

          <div className="h-4 w-px bg-slate-700 hidden sm:block" />

          {/* Quick Stage Bulk Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Move to:</span>
            <select
              value={bulkStage}
              onChange={(e) => setBulkStage(e.target.value as LeadStage)}
              className="text-xs bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">Select Stage...</option>
              {STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Rep Bulk Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Reassign:</span>
            <select
              value={bulkRepId}
              onChange={(e) => setBulkRepId(e.target.value)}
              className="text-xs bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">Select Rep...</option>
              {effectiveUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleApplyBulkUpdates}
            disabled={isApplyingBulk || (!bulkStage && !bulkRepId)}
            className="ml-auto px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50"
          >
            {isApplyingBulk ? 'Applying...' : 'Apply Updates'}
          </button>
        </div>
      )}
    </div>
  );
};
