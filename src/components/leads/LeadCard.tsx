import React from 'react';
import { Star, Phone, MessageSquare, ExternalLink, CheckSquare, Square } from 'lucide-react';
import { Lead } from '../../types';
import { AvatarBadge } from '../common/AvatarBadge';
import { StatusPill } from '../common/StatusPill';

interface LeadCardProps {
  lead: Lead;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onSelectLead?: (lead: Lead) => void;
  onInitiateCall?: (lead: Lead) => void;
  onOpenChat?: (lead: Lead) => void;
  onRatingChange?: (lead: Lead, rating: number) => void;
}

/**
 * LeadCard — Mobile-optimized card view for a single lead.
 * 
 * Replaces the table row on screens < 640px. Shows critical information
 * at a glance with separate, accessible selection checkbox and prominent
 * View, Call, and WhatsApp action buttons.
 */
export const LeadCard: React.FC<LeadCardProps> = ({
  lead,
  isSelected,
  onToggleSelect,
  onSelectLead,
  onInitiateCall,
  onOpenChat,
  onRatingChange
}) => {
  const val = Number(lead.value) || 0;
  const formattedValue =
    val >= 100000
      ? `₹ ${(val / 100000).toFixed(1)} L`
      : `₹ ${val.toLocaleString('en-IN')}`;

  const assigneeName = lead.assignedRepName || (lead as any).assignee || 'Unassigned';
  const currentRating = (lead.customFields?.rating as number) ?? (lead as any).rating ?? 0;
  const companyOrProject = lead.industry || (lead as any).companyOrProject;

  return (
    <div
      onClick={() => onSelectLead?.(lead)}
      className={`rounded-2xl border transition-all duration-200 cursor-pointer ${
        isSelected
          ? 'border-[#00695C] bg-[#CCE8E1]/20 dark:bg-[#004F46]/20 shadow-sm'
          : 'border-[#E2E8F0]/50 dark:border-[#334155]/50 bg-[#F8FAF9] dark:bg-[#161A19] hover:border-[#00695C]/60 hover:shadow-md'
      }`}
    >
      {/* Card Header — separate checkbox and tap area */}
      <div className="p-4 pb-2 flex items-start justify-between gap-3">
        {/* Dedicated Selection Checkbox */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(lead.id);
          }}
          aria-label={`${isSelected ? 'Deselect' : 'Select'} lead ${lead.name}`}
          className="mt-0.5 p-1 -ml-1 text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
        >
          {isSelected ? (
            <CheckSquare className="w-5 h-5 text-[#00695C] dark:text-[#80D5C4]" />
          ) : (
            <Square className="w-5 h-5 text-slate-300 dark:text-slate-600" />
          )}
        </button>

        {/* Name + Phone (clicking navigates) */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-[#0F172A] dark:text-[#F1F5F9] truncate hover:text-[#00695C] transition-colors">
              {lead.name}
            </h3>
          </div>
          <p className="text-xs text-[#475569] dark:text-[#94A3B8] font-mono">
            {lead.phone}
          </p>
          {companyOrProject && (
            <p className="text-xs text-[#475569] dark:text-[#94A3B8] truncate mt-0.5">
              {companyOrProject}
            </p>
          )}
        </div>

        {/* Status Pill & Value */}
        <div className="shrink-0 flex flex-col items-end gap-1">
          <StatusPill status={lead.stage} size="sm" />
          <span className="text-xs font-mono font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
            {formattedValue}
          </span>
        </div>
      </div>

      {/* Card Body — metadata row */}
      <div className="px-4 pb-2 flex items-center justify-between gap-3 flex-wrap">
        {/* Stars + Assignee */}
        <div className="flex items-center gap-3 text-xs text-[#475569] dark:text-[#94A3B8] min-w-0">
          {/* Star rating */}
          <div
            className="flex items-center gap-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRatingChange?.(lead, currentRating === star ? 0 : star);
                }}
                aria-label={`Set rating to ${star} stars`}
                className="w-6 h-6 flex items-center justify-center rounded-full"
              >
                <Star
                  className={`w-3.5 h-3.5 ${
                    star <= currentRating
                      ? 'text-amber-500 fill-amber-500'
                      : 'text-[#E2E8F0] dark:text-[#475569]'
                  }`}
                />
              </button>
            ))}
          </div>

          {/* Assignee */}
          <div className="flex items-center gap-1.5 truncate">
            <AvatarBadge name={assigneeName} size="sm" />
            <span className="truncate">{assigneeName}</span>
          </div>
        </div>

        {/* Source */}
        <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-[#F1F5F4] dark:bg-[#1E293B] text-slate-600 dark:text-slate-300">
          {lead.source}
        </span>
      </div>

      {/* Compliance indicators (if any) */}
      {(lead.fatigueStatus === 'capped' || lead.fatigueStatus === 'near_cap' || (lead.fatigueStatus as any) === 'at_risk' || lead.preferences?.preferredChannel === 'WhatsApp' || lead.preferences?.isPaused30Days) && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {lead.fatigueStatus === 'capped' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#FFDAD6] text-[#410002]">
              🛑 Capped (3/3)
            </span>
          )}
          {(lead.fatigueStatus === 'near_cap' || (lead.fatigueStatus as any) === 'at_risk') && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-200">
              ⚠️ Near Cap (2/3)
            </span>
          )}
          {lead.preferences?.preferredChannel === 'WhatsApp' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#CCE8E1] text-[#00201B]">
              💬 WA Only
            </span>
          )}
          {lead.preferences?.isPaused30Days && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-100 text-orange-900">
              ⏸️ Paused 30d
            </span>
          )}
        </div>
      )}

      {/* Action buttons — isolated with stopPropagation */}
      <div
        className="px-4 pb-4 pt-1 flex items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* View Profile Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelectLead?.(lead);
          }}
          aria-label={`View full profile for ${lead.name}`}
          className="px-3 min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
          <span>View</span>
        </button>

        {/* Call Button */}
        {(() => {
          const isCallBlocked =
            lead.fatigueStatus === 'capped' ||
            lead.preferences?.preferredChannel === 'WhatsApp' ||
            lead.preferences?.isOptedOut;

          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!isCallBlocked) onInitiateCall?.(lead);
              }}
              disabled={isCallBlocked}
              aria-label={`Call ${lead.name}`}
              title={isCallBlocked ? 'Calling restricted for this lead' : `Call ${lead.name}`}
              className={`flex-1 min-h-[44px] flex items-center justify-center gap-2 rounded-xl text-xs font-semibold transition-all ${
                isCallBlocked
                  ? 'bg-[#F1F5F4] dark:bg-[#1E293B] text-[#475569] cursor-not-allowed'
                  : 'bg-[#CCE8E1] dark:bg-[#005046] text-[#00201B] dark:text-[#A3F2E4] hover:bg-[#B7DFD6] dark:hover:bg-[#006558] active:scale-[0.98]'
              }`}
            >
              <Phone className="w-4 h-4" />
              <span>Call</span>
            </button>
          );
        })()}

        {/* WhatsApp Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenChat?.(lead);
          }}
          aria-label={`Chat with ${lead.name} on WhatsApp`}
          className="flex-1 min-h-[44px] flex items-center justify-center gap-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.98] transition-all"
        >
          <MessageSquare className="w-4 h-4 text-emerald-200" />
          <span>WhatsApp</span>
        </button>
      </div>
    </div>
  );
};
