import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  Phone,
  MessageSquare,
  Clock,
  Calendar,
  UserCheck,
  Tag,
  FileText,
  Briefcase,
  IndianRupee,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  History,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Mail,
  Building,
  Layers,
  Award,
  Send,
  Sliders,
  Check,
  X,
  ExternalLink,
  ChevronRight,
  Info
} from 'lucide-react';
import { Lead, LeadStage, Call, Message, User, FatigueStatus, PreferredChannel } from '../../types';
import { api } from '../../services/api';
import { MaterialDropdown } from '../common/MaterialDropdown';

export interface LeadProfileViewProps {
  leadId: string;
  initialLead?: Lead | null;
  users: User[];
  onBack: () => void;
  onStartCall: (lead: Lead) => void;
  onOpenWhatsApp: (lead: Lead) => void;
  onUpdateLead: (updated: Lead) => void;
  onUpdateStage?: (leadId: string, stage: LeadStage) => void;
  onAssignRep?: (leadId: string, repId: string) => void;
}

const STAGES: LeadStage[] = ['New', 'Contacted', 'Follow-up', 'Negotiation', 'Won', 'Lost'];

export const LeadProfileView: React.FC<LeadProfileViewProps> = ({
  leadId,
  initialLead,
  users,
  onBack,
  onStartCall,
  onOpenWhatsApp,
  onUpdateLead,
  onUpdateStage,
  onAssignRep
}) => {
  const [lead, setLead] = useState<Lead | null>(initialLead || null);
  const [isLoadingLead, setIsLoadingLead] = useState<boolean>(!initialLead);
  const [leadFetchError, setLeadFetchError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<number | null>(null);

  // Tabs: 'overview' | 'activity' | 'compliance' | 'pipeline' | 'notes' | 'followup' | 'custom'
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'compliance' | 'pipeline' | 'notes' | 'followup' | 'custom'>('overview');

  // Activity Timeline State
  const [calls, setCalls] = useState<Call[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState<boolean>(false);
  const [activityFilter, setActivityFilter] = useState<'all' | 'calls' | 'messages'>('all');

  // Notes state
  const [notesInput, setNotesInput] = useState<string>(initialLead?.notes || '');
  const [isSavingNotes, setIsSavingNotes] = useState<boolean>(false);
  const [notesFeedback, setNotesFeedback] = useState<string | null>(null);
  const [notesError, setNotesError] = useState<string | null>(null);

  // Callback reminder state
  const [callbackInput, setCallbackInput] = useState<string>(
    initialLead?.callbackReminder ? new Date(initialLead.callbackReminder).toISOString().slice(0, 16) : ''
  );
  const [isSavingReminder, setIsSavingReminder] = useState<boolean>(false);
  const [reminderFeedback, setReminderFeedback] = useState<string | null>(null);
  const [reminderError, setReminderError] = useState<string | null>(null);

  // General action error/feedback
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Load / Refresh Lead Record
  const loadFreshLead = useCallback(async () => {
    if (!leadId) return;
    try {
      setLeadFetchError(null);
      const fresh = await api.getLead(leadId);
      setLead(fresh);
      setNotesInput(fresh.notes || '');
      setCallbackInput(
        fresh.callbackReminder ? new Date(fresh.callbackReminder).toISOString().slice(0, 16) : ''
      );
    } catch (err: any) {
      console.error('Failed to load lead:', err);
      const status = err?.status || (err?.message?.includes('403') ? 403 : err?.message?.includes('404') ? 404 : 500);
      setErrorCode(status);
      if (status === 403) {
        setLeadFetchError('You do not have permission to view this lead record or it belongs to another organization.');
      } else if (status === 404) {
        setLeadFetchError('Lead record not found or may have been deleted.');
      } else {
        setLeadFetchError(err?.message || 'Failed to fetch lead details.');
      }
    } finally {
      setIsLoadingLead(false);
    }
  }, [leadId]);

  useEffect(() => {
    if (initialLead && initialLead.id === leadId) {
      setLead(initialLead);
      setNotesInput(initialLead.notes || '');
      setCallbackInput(
        initialLead.callbackReminder ? new Date(initialLead.callbackReminder).toISOString().slice(0, 16) : ''
      );
    }
    loadFreshLead();
  }, [leadId, loadFreshLead]);

  // Load Lead Activity Timeline
  const loadActivity = useCallback(async () => {
    if (!leadId) return;
    setIsLoadingActivity(true);
    try {
      const [fetchedCalls, fetchedMessages] = await Promise.all([
        api.getCalls({ leadId }),
        api.getMessages(leadId)
      ]);
      setCalls(fetchedCalls || []);
      setMessages(fetchedMessages || []);
    } catch (err: any) {
      console.error('Failed to load activity:', err);
    } finally {
      setIsLoadingActivity(false);
    }
  }, [leadId]);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  // Handle stage update
  const handleStageChange = async (newStage: LeadStage) => {
    if (!lead || lead.stage === newStage) return;
    setActionError(null);
    setActionSuccess(null);
    try {
      const updated = await api.updateLead(lead.id, {
        stage: newStage,
        version: lead.version,
        updatedAt: lead.updatedAt
      });
      setLead(updated);
      onUpdateLead(updated);
      if (onUpdateStage) onUpdateStage(lead.id, newStage);
      setActionSuccess(`Stage updated to ${newStage}`);
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      console.error('Failed to update stage:', err);
      if (err?.status === 409 || err?.data?.code === 'CONCURRENCY_CONFLICT') {
        setActionError('Conflict: This lead was updated by another session. Refreshing data...');
        loadFreshLead();
      } else {
        setActionError(err?.message || 'Failed to update pipeline stage.');
      }
    }
  };

  // Handle assigned rep update
  const handleRepChange = async (repId: string) => {
    if (!lead || lead.assignedRepId === repId) return;
    setActionError(null);
    setActionSuccess(null);
    const rep = users.find((u) => u.id === repId);
    try {
      const updated = await api.updateLead(lead.id, {
        assignedRepId: repId,
        assignedRepName: rep ? rep.name : lead.assignedRepName,
        version: lead.version,
        updatedAt: lead.updatedAt
      });
      setLead(updated);
      onUpdateLead(updated);
      if (onAssignRep) onAssignRep(lead.id, repId);
      setActionSuccess(`Reassigned to ${rep?.name || 'team member'}`);
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      console.error('Failed to reassign lead:', err);
      if (err?.status === 409 || err?.data?.code === 'CONCURRENCY_CONFLICT') {
        setActionError('Conflict: This lead was updated by another session. Refreshing data...');
        loadFreshLead();
      } else {
        setActionError(err?.message || 'Failed to reassign lead.');
      }
    }
  };

  // Save Notes handler with concurrency handling
  const handleSaveNotes = async () => {
    if (!lead || isSavingNotes) return;
    setIsSavingNotes(true);
    setNotesError(null);
    setNotesFeedback(null);
    try {
      const updated = await api.updateLead(lead.id, {
        notes: notesInput.trim(),
        version: lead.version,
        updatedAt: lead.updatedAt
      });
      setLead(updated);
      onUpdateLead(updated);
      setNotesFeedback('Notes successfully saved.');
      setTimeout(() => setNotesFeedback(null), 3500);
    } catch (err: any) {
      console.error('Failed to save notes:', err);
      if (err?.status === 409 || err?.data?.code === 'CONCURRENCY_CONFLICT') {
        setNotesError('Conflict: This lead was updated in another session. Please reload to review changes.');
      } else {
        setNotesError(err?.message || 'Failed to persist notes to database.');
      }
    } finally {
      setIsSavingNotes(false);
    }
  };

  // Save or Clear Callback Reminder
  const handleSaveReminder = async (clear = false) => {
    if (!lead || isSavingReminder) return;
    setIsSavingReminder(true);
    setReminderError(null);
    setReminderFeedback(null);
    try {
      const reminderIso = clear || !callbackInput ? null : new Date(callbackInput).toISOString();
      const updated = await api.updateLead(lead.id, {
        callbackReminder: reminderIso,
        version: lead.version,
        updatedAt: lead.updatedAt
      });
      setLead(updated);
      onUpdateLead(updated);
      if (clear) {
        setCallbackInput('');
        setReminderFeedback('Callback reminder cleared.');
      } else {
        setReminderFeedback('Callback reminder scheduled successfully.');
      }
      setTimeout(() => setReminderFeedback(null), 3500);
    } catch (err: any) {
      console.error('Failed to update callback reminder:', err);
      if (err?.status === 409 || err?.data?.code === 'CONCURRENCY_CONFLICT') {
        setReminderError('Conflict: This lead was updated elsewhere. Please reload.');
      } else {
        setReminderError(err?.message || 'Failed to update callback reminder.');
      }
    } finally {
      setIsSavingReminder(false);
    }
  };

  // Unified timeline sorting
  const combinedTimeline = useMemo(() => {
    const list: Array<{
      type: 'call' | 'message';
      time: string;
      data: Call | Message;
    }> = [];

    if (activityFilter === 'all' || activityFilter === 'calls') {
      calls.forEach((c) => list.push({ type: 'call', time: c.timestamp, data: c }));
    }
    if (activityFilter === 'all' || activityFilter === 'messages') {
      messages.forEach((m) => list.push({ type: 'message', time: m.timestamp, data: m }));
    }

    return list.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  }, [calls, messages, activityFilter]);

  // Format currency in INR
  const formatCurrency = (val?: number) => {
    if (val === undefined || val === null) return '—';
    return `₹${val.toLocaleString('en-IN')}`;
  };

  // Reminder status helper
  const reminderStatus = useMemo(() => {
    if (!lead?.callbackReminder) return null;
    const remTime = new Date(lead.callbackReminder).getTime();
    const now = Date.now();
    const isOverdue = remTime < now;
    return {
      isOverdue,
      text: isOverdue ? 'Overdue Reminder' : 'Upcoming Reminder',
      formatted: new Date(lead.callbackReminder).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short'
      })
    };
  }, [lead?.callbackReminder]);

  // Loading state
  if (isLoadingLead && !lead) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#F8FAF9] dark:bg-[#111514]">
        <div className="w-10 h-10 border-4 border-[#00695C] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Loading lead profile...</p>
      </div>
    );
  }

  // Error / Not Found / Forbidden state
  if (leadFetchError && !lead) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#F8FAF9] dark:bg-[#111514]">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center shadow-lg">
          <div className="w-12 h-12 mx-auto rounded-full bg-rose-100 dark:bg-rose-950 flex items-center justify-center text-rose-600 mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2 font-heading">
            {errorCode === 403 ? 'Access Restricted' : errorCode === 404 ? 'Lead Not Found' : 'Unable to Load Profile'}
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mb-6 font-body">
            {leadFetchError}
          </p>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[#00695C] text-white hover:bg-[#004D40] focus:ring-2 focus:ring-[#00695C]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Leads</span>
          </button>
        </div>
      </div>
    );
  }

  if (!lead) return null;

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 bg-[#F8FAF9] dark:bg-[#111514] overflow-hidden">
      {/* 1. Profile Top Breadcrumb & Quick Actions Bar */}
      <header className="shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Breadcrumbs and Lead Identification */}
          <div className="flex items-center space-x-3 min-w-0">
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to Leads list"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00695C]"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <nav aria-label="Breadcrumb" className="flex items-center space-x-1.5 text-xs">
              <button
                type="button"
                onClick={onBack}
                className="font-medium text-slate-500 dark:text-slate-400 hover:text-[#00695C] dark:hover:text-teal-400 transition-colors"
              >
                Leads
              </button>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[200px] sm:max-w-[320px]">
                {lead.name}
              </span>
            </nav>

            <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono font-semibold rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              ID: {lead.id}
            </span>
          </div>

          {/* Quick Primary Actions */}
          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => onStartCall(lead)}
              aria-label={`Call ${lead.name}`}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#00695C] text-white hover:bg-[#004D40] shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00695C] transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Call</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenWhatsApp(lead)}
              aria-label={`Open WhatsApp chat with ${lead.name}`}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#25D366] text-white hover:bg-[#1EBE5D] shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={loadFreshLead}
              title="Refresh lead record"
              aria-label="Refresh lead record"
              className="p-1.5 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global Action Banner */}
        {actionError && (
          <div className="mt-2.5 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300 font-semibold flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="p-1 text-rose-600 hover:text-rose-800"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {actionSuccess && (
          <div className="mt-2.5 p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 font-semibold flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}
      </header>

      {/* 2. Lead Summary Header Card */}
      <section className="shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Avatar, Name, Phone & Badges */}
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-[#CCE8E1] dark:bg-[#004D40] text-[#004D40] dark:text-[#CCE8E1] flex items-center justify-center font-bold text-lg shadow-sm font-heading shrink-0">
              {lead.name ? lead.name.charAt(0).toUpperCase() : 'L'}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 font-heading">
                  {lead.name}
                </h1>

                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-body">
                  Source: {lead.source || '—'}
                </span>

                {lead.industry && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 dark:bg-teal-950/50 text-[#00695C] dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                    {lead.industry}
                  </span>
                )}

                {/* Compliance Badges */}
                {lead.fatigueStatus === 'capped' && (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300">
                    <ShieldAlert className="w-3 h-3" />
                    <span>Frequency Capped</span>
                  </span>
                )}
                {lead.fatigueStatus === 'near_cap' && (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300">
                    <ShieldAlert className="w-3 h-3" />
                    <span>Near Cap</span>
                  </span>
                )}
                {lead.preferences?.isOptedOut && (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300">
                    <X className="w-3 h-3" />
                    <span>Opted Out</span>
                  </span>
                )}
                {lead.preferences?.isPaused30Days && (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300">
                    <Clock className="w-3 h-3" />
                    <span>Paused</span>
                  </span>
                )}
                {lead.preferences?.preferredChannel === 'WhatsApp' && (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300">
                    <span>WhatsApp Only</span>
                  </span>
                )}
                {lead.blockedReason && (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300">
                    <ShieldAlert className="w-3 h-3" />
                    <span>Blocked: {lead.blockedReason}</span>
                  </span>
                )}
              </div>

              {/* Contact meta line */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">
                  {lead.phone}
                </span>
                {lead.email && (
                  <>
                    <span>•</span>
                    <span className="text-slate-600 dark:text-slate-300">{lead.email}</span>
                  </>
                )}
                <span>•</span>
                <span>Created {new Date(lead.createdDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                {lead.updatedAt && (
                  <>
                    <span>•</span>
                    <span>Updated {new Date(lead.updatedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick Header Indicators: Value, Stage, Assigned Rep */}
          <div className="flex flex-wrap items-center gap-3 lg:justify-end">
            {/* Estimated Value */}
            <div className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-left">
              <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">
                Estimated Value
              </span>
              <span className="text-sm font-extrabold text-[#00695C] dark:text-teal-400">
                {formatCurrency(lead.value)}
              </span>
            </div>

            {/* Pipeline Stage Quick Switcher */}
            <div className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-left">
              <label htmlFor="header-stage-select" className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 mb-0.5">
                Stage
              </label>
              <select
                id="header-stage-select"
                value={lead.stage}
                onChange={(e) => handleStageChange(e.target.value as LeadStage)}
                className="text-xs font-bold text-slate-800 dark:text-slate-200 bg-transparent border-none p-0 focus:ring-0 cursor-pointer"
              >
                {STAGES.map((st) => (
                  <option key={st} value={st} className="dark:bg-slate-900">
                    {st}
                  </option>
                ))}
              </select>
            </div>

            {/* Assigned Rep Quick Switcher */}
            <div className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-left min-w-[140px]">
              <label htmlFor="header-rep-select" className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 mb-0.5">
                Assigned Rep
              </label>
              <select
                id="header-rep-select"
                value={lead.assignedRepId}
                onChange={(e) => handleRepChange(e.target.value)}
                className="text-xs font-semibold text-slate-800 dark:text-slate-200 bg-transparent border-none p-0 focus:ring-0 cursor-pointer w-full truncate"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id} className="dark:bg-slate-900">
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Reminder notification badge if present */}
        {reminderStatus && (
          <div className={`mt-3 px-3 py-2 rounded-xl text-xs flex items-center justify-between border ${
            reminderStatus.isOverdue
              ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
              : 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
          }`}>
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 shrink-0" />
              <span className="font-bold">{reminderStatus.text}:</span>
              <span>{reminderStatus.formatted}</span>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('followup')}
              className="font-bold underline hover:opacity-80"
            >
              Manage Follow-up
            </button>
          </div>
        )}
      </section>

      {/* 3. Navigation Tabs */}
      <nav aria-label="Lead profile tabs" className="shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex space-x-1 sm:space-x-4 overflow-x-auto no-scrollbar">
        {[
          { id: 'overview', label: 'Overview', icon: FileText },
          { id: 'activity', label: 'Activity Timeline', icon: History, badge: combinedTimeline.length },
          { id: 'compliance', label: 'Compliance & Preferences', icon: ShieldCheck },
          { id: 'pipeline', label: 'Pipeline & Stage', icon: TrendingUp },
          { id: 'notes', label: 'Notes & Requirements', icon: FileText },
          { id: 'followup', label: 'Follow-ups', icon: Calendar },
          { id: 'custom', label: 'Custom Fields', icon: Layers }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-1.5 py-3 px-2 border-b-2 text-xs font-bold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00695C] ${
                isActive
                  ? 'border-[#00695C] text-[#00695C] dark:text-teal-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:border-slate-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {typeof tab.badge === 'number' && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isActive
                    ? 'bg-[#00695C]/10 text-[#00695C] dark:bg-teal-950 dark:text-teal-300'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* 4. Tab Content Body (Scrollable Container) */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {/* ========================================================================= */}
        {/* TAB 1: OVERVIEW */}
        {/* ========================================================================= */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Lead Information & Notes Preview */}
            <div className="lg:col-span-2 space-y-6">
              {/* Core Information Card */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4 flex items-center space-x-2 font-heading">
                  <FileText className="w-4 h-4 text-[#00695C]" />
                  <span>Lead Record Details</span>
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Full Name</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-sm mt-0.5 block">{lead.name || '—'}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Phone Number</span>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">{lead.phone || '—'}</span>
                      <button
                        type="button"
                        onClick={() => onStartCall(lead)}
                        className="text-[#00695C] hover:text-[#004D40] dark:text-teal-400 p-1"
                        title="Call Phone"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Email Address</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block truncate">
                      {lead.email || 'Not provided'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Industry / Company</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block">
                      {lead.industry || 'Not provided'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Lead Source</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block">{lead.source || '—'}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Campaign</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block">
                      {lead.assignedCampaign || 'Not provided'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Created Timestamp</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block">
                      {new Date(lead.createdDate).toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Last Modified Timestamp</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block">
                      {lead.updatedAt ? new Date(lead.updatedAt).toLocaleString('en-IN') : 'Not modified'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notes Preview Card */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center space-x-2 font-heading">
                    <FileText className="w-4 h-4 text-[#00695C]" />
                    <span>Telecaller Notes & Instructions</span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('notes')}
                    className="text-xs font-bold text-[#00695C] dark:text-teal-400 hover:underline"
                  >
                    Edit Notes
                  </button>
                </div>

                {lead.notes ? (
                  <p className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {lead.notes}
                  </p>
                ) : (
                  <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                    No notes recorded yet. Click "Edit Notes" to capture client requirements.
                  </div>
                )}
              </div>
            </div>

            {/* Right 1 Col: Ownership, Quick Stage & Compliance Mini Cards */}
            <div className="space-y-6">
              {/* Ownership Card */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center space-x-2 font-heading">
                  <UserCheck className="w-4 h-4 text-[#00695C]" />
                  <span>Ownership & Team</span>
                </h2>

                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Assigned Representative</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-sm mt-0.5 block">
                      {lead.assignedRepName || 'Unassigned'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Team ID / Division</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 mt-0.5 block">
                      {lead.teamId || 'Default Organization Team'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Pipeline Stage</span>
                    <span className="font-bold text-[#00695C] dark:text-teal-400 mt-0.5 block">
                      {lead.stage}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Estimated Value</span>
                    <span className="font-extrabold text-slate-900 dark:text-slate-100 text-base mt-0.5 block">
                      {formatCurrency(lead.value)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Recent Activity Quick Teaser */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center space-x-2 font-heading">
                    <History className="w-4 h-4 text-[#00695C]" />
                    <span>Recent History</span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('activity')}
                    className="text-xs font-bold text-[#00695C] dark:text-teal-400 hover:underline"
                  >
                    View All
                  </button>
                </div>

                {combinedTimeline.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-3">No activity logged yet.</p>
                ) : (
                  <div className="space-y-2">
                    {combinedTimeline.slice(0, 3).map((item, idx) => (
                      <div key={idx} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200">
                          <span>{item.type === 'call' ? 'Phone Call' : 'WhatsApp Message'}</span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(item.time).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        {item.type === 'call' && (
                          <p className="text-[11px] text-teal-600 dark:text-teal-400 font-medium mt-0.5">
                            Outcome: {(item.data as Call).outcome}
                          </p>
                        )}
                        {item.type === 'message' && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate mt-0.5">
                            "{(item.data as Message).text}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: ACTIVITY TIMELINE */}
        {/* ========================================================================= */}
        {activeTab === 'activity' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs max-w-4xl mx-auto">
            {/* Timeline Filter Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">
                  Interaction Activity Timeline
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Real backend logs for calls and WhatsApp messages scoped to this lead.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setActivityFilter('all')}
                    className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                      activityFilter === 'all'
                        ? 'bg-white dark:bg-slate-900 text-[#00695C] dark:text-teal-400 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                    }`}
                  >
                    All ({calls.length + messages.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivityFilter('calls')}
                    className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                      activityFilter === 'calls'
                        ? 'bg-white dark:bg-slate-900 text-[#00695C] dark:text-teal-400 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                    }`}
                  >
                    Calls ({calls.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivityFilter('messages')}
                    className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                      activityFilter === 'messages'
                        ? 'bg-white dark:bg-slate-900 text-[#00695C] dark:text-teal-400 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                    }`}
                  >
                    WhatsApp ({messages.length})
                  </button>
                </div>

                <button
                  type="button"
                  onClick={loadActivity}
                  title="Refresh Timeline"
                  className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingActivity ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Timeline Stream */}
            {isLoadingActivity ? (
              <div className="py-12 text-center text-xs text-slate-400">
                <div className="w-8 h-8 border-3 border-[#00695C] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <span>Loading activity history...</span>
              </div>
            ) : combinedTimeline.length === 0 ? (
              <div className="py-12 px-4 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-500">
                <History className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
                <p className="font-bold text-slate-700 dark:text-slate-300">No activity recorded for this lead yet.</p>
                <p className="text-slate-400 mt-1">Initiate a phone call or send a WhatsApp message to start the conversation history.</p>
                <div className="mt-4 flex items-center justify-center space-x-3">
                  <button
                    type="button"
                    onClick={() => onStartCall(lead)}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#00695C] text-white hover:bg-[#004D40]"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Call Now</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenWhatsApp(lead)}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#25D366] text-white hover:bg-[#1EBE5D]"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative pl-8 space-y-6 before:absolute before:top-2 before:bottom-2 before:left-3.5 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                {combinedTimeline.map((item, idx) => {
                  if (item.type === 'call') {
                    const call = item.data as Call;
                    return (
                      <div key={call.id || idx} className="relative group">
                        <div className="absolute -left-8 top-1.5 w-7 h-7 rounded-full bg-[#1E293B] text-teal-300 flex items-center justify-center text-xs shadow-xs">
                          <Phone className="w-3.5 h-3.5" />
                        </div>
                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 shadow-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-1">
                            <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                              <span>Phone Call Logged</span>
                              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                {Math.floor(call.duration / 60)}m {call.duration % 60}s
                              </span>
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {new Date(call.timestamp).toLocaleString('en-IN', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs mb-2">
                            <span className="font-bold text-teal-700 dark:text-teal-400">
                              Outcome: {call.outcome}
                            </span>
                            <span className="text-slate-400">•</span>
                            <span className="text-slate-600 dark:text-slate-300 font-medium">
                              Rep: {call.repName || 'Aakash Verma'}
                            </span>
                          </div>

                          {call.notes && (
                            <p className="text-xs text-slate-700 dark:text-slate-300 italic bg-white dark:bg-slate-900/70 p-3 rounded-xl border border-slate-200/70 dark:border-slate-800 leading-relaxed">
                              "{call.notes}"
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  } else {
                    const msg = item.data as Message;
                    const isOutbound = msg.direction === 'outbound';
                    return (
                      <div key={msg.id || idx} className="relative group">
                        <div
                          className={`absolute -left-8 top-1.5 w-7 h-7 rounded-full flex items-center justify-center text-xs shadow-xs ${
                            isOutbound ? 'bg-[#25D366] text-white' : 'bg-slate-700 text-white'
                          }`}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </div>
                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 shadow-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-1">
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                              {isOutbound ? 'WhatsApp Sent' : 'WhatsApp Inbound Message'}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {new Date(msg.timestamp).toLocaleString('en-IN', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>

                          <p className="text-xs text-slate-800 dark:text-slate-200 mt-1 leading-relaxed bg-white dark:bg-slate-900/70 p-3 rounded-xl border border-slate-200/70 dark:border-slate-800">
                            {msg.text}
                          </p>

                          <div className="mt-2 flex items-center justify-end text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                            <span>Delivery Status: {msg.deliveryStatus}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: COMPLIANCE & PREFERENCES */}
        {/* ========================================================================= */}
        {activeTab === 'compliance' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs max-w-4xl mx-auto space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-[#00695C]" />
                <span>Contact & Communication Preferences</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Enforces caller fatigue limits, preferred channels, calling windows, and opt-out directives according to TRAI/DoT compliance rules.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Preferred Channel */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-bold uppercase tracking-wider">
                  Preferred Contact Channel
                </span>
                <span className="font-extrabold text-slate-900 dark:text-slate-100 text-sm mt-1 block">
                  {lead.preferences?.preferredChannel || 'Any channel allowed'}
                </span>
              </div>

              {/* Preferred Time Window */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-bold uppercase tracking-wider">
                  Preferred Calling Window
                </span>
                <span className="font-extrabold text-slate-900 dark:text-slate-100 text-sm mt-1 block">
                  {lead.preferences?.preferredTimeWindow || 'Anytime (10 AM - 7 PM compliant)'}
                </span>
              </div>

              {/* Frequency Cap & Fatigue */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-bold uppercase tracking-wider">
                  Caller Fatigue Status
                </span>
                <div className="mt-1 flex items-center space-x-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                    lead.fatigueStatus === 'capped'
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      : lead.fatigueStatus === 'near_cap'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  }`}>
                    {lead.fatigueStatus ? lead.fatigueStatus.toUpperCase() : 'NORMAL'}
                  </span>
                </div>
              </div>

              {/* 7-Day Contact Attempts */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-bold uppercase tracking-wider">
                  7-Day Contact Attempts
                </span>
                <div className="mt-1 flex items-center space-x-4 font-mono font-bold text-slate-900 dark:text-slate-100 text-xs">
                  <span>Calls: {lead.contactAttempts7d?.calls ?? 0}</span>
                  <span>WhatsApp: {lead.contactAttempts7d?.whatsapp ?? 0}</span>
                  <span>SMS: {lead.contactAttempts7d?.sms ?? 0}</span>
                </div>
              </div>

              {/* Opt-out Status */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-bold uppercase tracking-wider">
                  Opt-Out Status
                </span>
                <span className="font-bold text-slate-900 dark:text-slate-100 text-xs mt-1 block">
                  {lead.preferences?.isOptedOut ? 'Opted Out of Communications' : 'Active / Subscribed'}
                </span>
                {lead.preferences?.optOutReason && (
                  <p className="text-[11px] text-slate-500 mt-1 italic">
                    Reason: {lead.preferences.optOutReason}
                  </p>
                )}
              </div>

              {/* Pause Status */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-bold uppercase tracking-wider">
                  Temporary 30-Day Pause
                </span>
                <span className="font-bold text-slate-900 dark:text-slate-100 text-xs mt-1 block">
                  {lead.preferences?.isPaused30Days ? 'Paused Until Date' : 'Not Paused'}
                </span>
                {lead.preferences?.pausedUntil && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Until: {new Date(lead.preferences.pausedUntil).toLocaleDateString('en-IN')}
                  </p>
                )}
              </div>

              {/* Declared Call Reason */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 md:col-span-2">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-bold uppercase tracking-wider">
                  Declared Business Call Reason
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs mt-1 block">
                  {lead.declaredCallReason || 'General product inquiry & customer support'}
                </span>
              </div>

              {/* Allowed Topics */}
              {lead.preferences?.allowedTopics && lead.preferences.allowedTopics.length > 0 && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 md:col-span-2">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-bold uppercase tracking-wider mb-1.5">
                    Allowed Communication Topics
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {lead.preferences.allowedTopics.map((topic, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950 text-[#00695C] dark:text-teal-300 font-semibold text-[11px] border border-teal-200 dark:border-teal-800">
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300 flex items-start space-x-2.5">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p>
                Compliance constraints are strictly enforced server-side. Outbound communication attempts to capped or opted-out leads are rejected by the telephony subsystem.
              </p>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: PIPELINE & STAGE */}
        {/* ========================================================================= */}
        {activeTab === 'pipeline' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs max-w-4xl mx-auto space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">
                Pipeline Progression & Team Ownership
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Transition this deal across stages or reassign ownership to an authorized telecaller.
              </p>
            </div>

            {/* Stage Progression Stepper */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Pipeline Stage Progression
                </span>
                <span className="text-xs font-extrabold text-[#00695C] dark:text-teal-400">
                  Current: {lead.stage}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {STAGES.map((st, idx) => {
                  const isActive = lead.stage === st;
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => handleStageChange(st)}
                      className={`p-3 rounded-xl text-xs font-bold border transition-all text-center flex flex-col items-center justify-center space-y-1 ${
                        isActive
                          ? 'bg-[#00695C] text-white border-[#00695C] shadow-md ring-2 ring-[#00695C]/30'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-[#00695C]'
                      }`}
                    >
                      <span className="text-[10px] opacity-70">Step {idx + 1}</span>
                      <span>{st}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Reassign Telecaller Card */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Assigned Telecaller & Rep
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Assigning to a new telecaller automatically inherits their team isolation scope.
              </p>
              <div className="max-w-md">
                <MaterialDropdown
                  value={lead.assignedRepId}
                  onChange={(val) => handleRepChange(val)}
                  variant="form"
                  options={users.map((u) => ({ value: u.id, label: `${u.name} (${u.role})` }))}
                />
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: NOTES & REQUIREMENTS */}
        {/* ========================================================================= */}
        {activeTab === 'notes' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs max-w-4xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">
                  Lead Notes & Telecalling Requirements
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Save critical objections, deal context, or customer requirements. Protected with optimistic version checking.
                </p>
              </div>

              <span className="text-xs font-mono text-slate-400">
                Version: {lead.version || 1}
              </span>
            </div>

            {notesError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300 font-semibold flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{notesError}</span>
              </div>
            )}

            {notesFeedback && (
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 font-semibold flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{notesFeedback}</span>
              </div>
            )}

            <div className="space-y-3">
              <textarea
                rows={8}
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                placeholder="Enter client talking points, product interests, budget objections, or follow-up notes..."
                className="w-full p-4 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00695C] leading-relaxed"
              />

              <div className="flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setNotesInput(lead.notes || '')}
                  disabled={isSavingNotes || notesInput === (lead.notes || '')}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={handleSaveNotes}
                  disabled={isSavingNotes}
                  className="inline-flex items-center space-x-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-[#00695C] text-white hover:bg-[#004D40] disabled:opacity-50 shadow-xs focus:ring-2 focus:ring-[#00695C]"
                >
                  {isSavingNotes ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving Notes...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save Notes</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: FOLLOW-UPS & REMINDERS */}
        {/* ========================================================================= */}
        {activeTab === 'followup' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs max-w-4xl mx-auto space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">
                Callback Reminders & Scheduled Follow-ups
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Schedule a precise callback reminder to ensure follow-up compliance and telecaller SLA alerts.
              </p>
            </div>

            {reminderError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300 font-semibold flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{reminderError}</span>
              </div>
            )}

            {reminderFeedback && (
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 font-semibold flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{reminderFeedback}</span>
              </div>
            )}

            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-4 max-w-md">
              <label htmlFor="callback-datetime-input" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Select Callback Date & Time
              </label>

              <input
                id="callback-datetime-input"
                type="datetime-local"
                value={callbackInput}
                onChange={(e) => setCallbackInput(e.target.value)}
                className="w-full text-xs p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#00695C]"
              />

              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleSaveReminder(false)}
                  disabled={isSavingReminder || !callbackInput}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#00695C] text-white hover:bg-[#004D40] disabled:opacity-50 shadow-xs"
                >
                  {isSavingReminder ? 'Saving...' : 'Set Reminder'}
                </button>

                {lead.callbackReminder && (
                  <button
                    type="button"
                    onClick={() => handleSaveReminder(true)}
                    disabled={isSavingReminder}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 border border-rose-200 dark:border-rose-800"
                  >
                    Clear Reminder
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 7: CUSTOM FIELDS */}
        {/* ========================================================================= */}
        {activeTab === 'custom' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs max-w-4xl mx-auto space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">
                Configured Custom Fields
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Custom tenant-specific metadata attributes stored in this lead record.
              </p>
            </div>

            {lead.customFields && Object.keys(lead.customFields).length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Object.entries(lead.customFields).map(([key, val]) => (
                  <div key={key} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                      {key.replace(/_/g, ' ')}
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 text-xs mt-1 block">
                      {typeof val === 'boolean'
                        ? val
                          ? 'True'
                          : 'False'
                        : typeof val === 'object'
                        ? JSON.stringify(val)
                        : String(val)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-400">
                No custom fields defined on this lead record.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
