import React from 'react';

interface StatusPillProps {
  status: string;
  className?: string;
  size?: 'sm' | 'md';
}

export const StatusPill: React.FC<StatusPillProps> = ({
  status,
  className = '',
  size = 'sm'
}) => {
  const norm = (status || '').toLowerCase().trim();

  // Consistent semantic status colors:
  // - amber/orange = "Upcoming/Pending" / "Call Back Later" / "Webinar Scheduled"
  // - red = "Late/Missed" / "Lost" / "RNR" / "Cancel"
  // - green = "Done/Connected/Won" / "Payment Done" / "Relevant"
  // - gray = "neutral/default" / "Fresh Lead" / "Reheated" / "Recorded Demo Sent"

  let badgeStyle = 'bg-[#F1F5F4] text-[#475569] border-[#E2E8F0] dark:bg-[#1E293B] dark:text-[#94A3B8] dark:border-[#334155]';

  if (
    norm.includes('upcoming') ||
    norm.includes('pending') ||
    norm.includes('call back') ||
    norm.includes('webinar scheduled') ||
    norm.includes('1-to-1 demo scheduled') ||
    norm.includes('follow')
  ) {
    badgeStyle = 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A] dark:bg-[#78350F]/40 dark:text-[#FCD34D] dark:border-[#92400E]';
  } else if (
    norm.includes('late') ||
    norm.includes('missed') ||
    norm.includes('lost') ||
    norm.includes('rnr') ||
    norm.includes('cancel') ||
    norm.includes('dropped') ||
    norm.includes('not interested')
  ) {
    badgeStyle = 'bg-[#FFDAD6] text-[#410002] border-[#FFB4AB] dark:bg-[#93000A]/40 dark:text-[#FFDAD6] dark:border-[#93000A]';
  } else if (
    norm.includes('won') ||
    norm.includes('done') ||
    norm.includes('connected') ||
    norm.includes('converted') ||
    norm.includes('webinar done') ||
    norm.includes('relevant')
  ) {
    badgeStyle = 'bg-[#CCE8E1] text-[#00201B] border-[#80D5C4]/60 dark:bg-[#004F46] dark:text-[#A3F2E4] dark:border-[#00695C]';
  } else if (norm.includes('fresh') || norm.includes('new')) {
    badgeStyle = 'bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD] dark:bg-[#0C4A6E]/30 dark:text-[#7DD3FC] dark:border-[#0369A1]';
  } else if (norm.includes('reheated') || norm.includes('quotation') || norm.includes('negotiation')) {
    badgeStyle = 'bg-[#E0E7FF] text-[#3730A3] border-[#C7D2FE] dark:bg-[#312E81]/30 dark:text-[#A5B4FC] dark:border-[#4338CA]';
  } else if (norm.includes('demo sent')) {
    badgeStyle = 'bg-[#F3E8FF] text-[#6B21A8] border-[#E9D5FF] dark:bg-[#581C87]/30 dark:text-[#D8B4FE] dark:border-[#7E22CE]';
  }

  const sizeClasses = size === 'sm' ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border tracking-tight whitespace-nowrap ${sizeClasses} ${badgeStyle} ${className}`}
    >
      {status}
    </span>
  );
};
