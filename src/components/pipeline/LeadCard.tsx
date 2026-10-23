import React from 'react';
import { Phone, MessageSquare, Clock, UserCheck, Building } from 'lucide-react';
import { MaterialDropdown } from '../common/MaterialDropdown';
import { Lead, LeadStage, User } from '../../types';

interface LeadCardProps {
  lead: Lead;
  users?: User[];
  onOpenDetail: (lead: Lead) => void;
  onStartCall: (lead: Lead) => void;
  onOpenWhatsApp: (lead: Lead) => void;
  onUpdateStage: (leadId: string, newStage: LeadStage) => void;
  onAssignRep?: (leadId: string, repId: string) => void;
  isDraggable?: boolean;
  onDragStart?: (e: React.DragEvent, leadId: string) => void;
  isSelected?: boolean;
  onToggleSelect?: (leadId: string) => void;
  isSelectMode?: boolean;
}

export const LeadCard: React.FC<LeadCardProps> = ({
  lead,
  users = [],
  onOpenDetail,
  onStartCall,
  onOpenWhatsApp,
  onAssignRep = (_leadId: string, _repId: string) => {},
  isDraggable = true,
  onDragStart,
  isSelected = false,
  onToggleSelect,
  isSelectMode = false
}) => {
  const getSourceBadge = (source: Lead['source']) => {
    switch (source) {
      case 'WhatsApp':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'IndiaMART':
        return 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'Website':
        return 'bg-sky-50 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800';
      case 'Google Ads':
        return 'bg-orange-50 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border-orange-200 dark:border-orange-800';
      case 'Facebook':
        return 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return null;
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)} L`;
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  // Check callback reminder
  const isCallbackDue = lead.callbackReminder ? new Date(lead.callbackReminder).getTime() <= Date.now() + 3600000 : false;
  const isCallbackOverdue = lead.callbackReminder ? new Date(lead.callbackReminder).getTime() < Date.now() : false;

  const assignedRep = users.find(u => u.id === lead.assignedRepId);

  return (
    <div
      id={`lead-card-${lead.id}`}
      draggable={isDraggable}
      onDragStart={(e) => onDragStart && onDragStart(e, lead.id)}
      className={`group relative bg-white dark:bg-[#181F1D] rounded-xl p-3.5 border transition-all duration-150 cursor-grab active:cursor-grabbing shadow-xs hover:shadow-md ${
        isSelected
          ? 'border-emerald-600 ring-2 ring-emerald-600/30 bg-emerald-50/20 dark:bg-emerald-950/20'
          : 'border-slate-200 dark:border-slate-800/80 hover:border-emerald-600/50'
      }`}
    >
      {/* Header: Select Checkbox, Name, Deal Value */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {(isSelectMode || onToggleSelect) && (
            <input
              type="checkbox"
              id={`select-lead-checkbox-${lead.id}`}
              aria-label={`Select lead ${lead.name}`}
              checked={isSelected}
              onChange={() => onToggleSelect && onToggleSelect(lead.id)}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 rounded text-emerald-600 border-slate-300 dark:border-slate-700 focus:ring-emerald-600 cursor-pointer shrink-0"
            />
          )}
          <button
            type="button"
            onClick={() => onOpenDetail(lead)}
            aria-label={`View details for ${lead.name}`}
            className="text-left font-semibold text-sm text-slate-900 dark:text-slate-100 hover:text-emerald-700 dark:hover:text-emerald-400 leading-snug transition-colors line-clamp-1"
          >
            {lead.name}
          </button>
        </div>

        {lead.value ? (
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-200/60 dark:border-emerald-800/60 whitespace-nowrap tabular-nums shrink-0">
            {formatCurrency(lead.value)}
          </span>
        ) : null}
      </div>

      {/* Contact & Meta Row */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mb-2.5">
        <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300 text-[11px]">
          {lead.phone}
        </span>
        <span className="text-slate-300 dark:text-slate-700">·</span>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${getSourceBadge(lead.source)}`}>
          {lead.source}
        </span>
        {lead.industry && (
          <>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <span className="text-[11px] text-slate-500 inline-flex items-center gap-1">
              <Building className="w-3 h-3 text-slate-400 shrink-0" />
              <span>{lead.industry}</span>
            </span>
          </>
        )}
      </div>

      {/* Notes / Requirement Preview */}
      {lead.notes && (
        <p
          onClick={() => onOpenDetail(lead)}
          className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-lg mb-3 line-clamp-2 leading-relaxed border border-slate-100 dark:border-slate-800/60 cursor-pointer hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition-colors"
          title={lead.notes}
        >
          "{lead.notes}"
        </p>
      )}

      {/* Callback Reminder Indicator */}
      {lead.callbackReminder && (
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium mb-2.5 border ${
            isCallbackOverdue
              ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
              : isCallbackDue
              ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
              : 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700'
          }`}
        >
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>
            {isCallbackOverdue ? 'Overdue Reminder' : 'Callback'}:{' '}
            {new Date(lead.callbackReminder).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      )}

      {/* Rep Assignment Row */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs mb-3">
        <div className="flex items-center gap-1 text-slate-500">
          <UserCheck className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[11px]">Owner:</span>
        </div>
        <MaterialDropdown
          id={`select-rep-${lead.id}`}
          value={lead.assignedRepId}
          ariaLabel={`Assign sales representative for ${lead.name}`}
          onChange={(val) => onAssignRep(lead.id, val)}
          variant="chip"
          triggerClassName="text-[11px] max-w-[150px] font-medium text-slate-700 dark:text-slate-200"
          options={users.map((u) => ({ value: u.id, label: `${u.name} (${u.role})` }))}
        />
      </div>

      {/* Action Buttons: Quick Call & WhatsApp */}
      <div className="grid grid-cols-2 gap-2">
        <button
          id={`btn-call-lead-${lead.id}`}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onStartCall(lead);
          }}
          aria-label={`Start phone call to ${lead.name}`}
          className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors shadow-xs active:scale-[0.98]"
        >
          <Phone className="w-3.5 h-3.5 text-teal-400" />
          <span>Call</span>
        </button>

        <button
          id={`btn-wa-lead-${lead.id}`}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenWhatsApp(lead);
          }}
          aria-label={`Open WhatsApp chat with ${lead.name}`}
          className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-xs active:scale-[0.98]"
        >
          <MessageSquare className="w-3.5 h-3.5 text-emerald-200" />
          <span>WhatsApp</span>
        </button>
      </div>
    </div>
  );
};
