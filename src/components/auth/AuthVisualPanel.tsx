import React, { useState } from 'react';
import { Heart, ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react';

interface SlideData {
  floatingTitle: string;
  floatingDesc: string;
  badgeIcon: 'heart' | 'shield';
  headline: string;
  tagline: string;
}

const SLIDES: SlideData[] = [
  {
    floatingTitle: 'Connect. Engage. Convert.',
    floatingDesc: 'Manage customer relationships, track conversations and turn every opportunity into measurable progress.',
    badgeIcon: 'heart',
    headline: 'Every Conversation. One Powerful CRM.',
    tagline: 'Build stronger customer relationships with DialPulse.'
  },
  {
    floatingTitle: 'Automate. Analyze. Accelerate.',
    floatingDesc: 'Enforce compliance guardrails, streamline telecalling outreach and accelerate pipeline velocity.',
    badgeIcon: 'shield',
    headline: 'Enterprise Telecom Intelligence.',
    tagline: 'High-density calling with built-in TRAI quiet-hour compliance.'
  }
];

export const AuthVisualPanel: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  const prevSlide = () => {
    setCurrentSlideIndex((prev) => (prev === 0 ? SLIDES.length - 1 : prev - 1));
  };

  const nextSlide = () => {
    setCurrentSlideIndex((prev) => (prev === SLIDES.length - 1 ? 0 : prev + 1));
  };

  const activeSlide = SLIDES[currentSlideIndex];

  return (
    <div className={`relative w-full h-full min-h-[460px] lg:min-h-full overflow-hidden rounded-2xl lg:rounded-r-[32px] lg:rounded-l-none bg-slate-900 select-none ${className}`}>
      {/* Background Image with Controlled Cropping & Scaling */}
      <img
        src="/login-illustration.jpg"
        alt="DialPulse Workspace"
        className="absolute inset-0 w-full h-full object-cover object-center filter saturate-[1.1] brightness-[0.92] transition-transform duration-700 hover:scale-105"
      />

      {/* Layered Gradient Overlays for Readability & Contrast */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10 pointer-events-none" />
      <div className="absolute inset-0 bg-[#075B65]/20 mix-blend-multiply pointer-events-none" />

      {/* Inner Flex Column to Guarantee Clean Separation on Short Laptops */}
      <div className="relative z-10 h-full flex flex-col justify-between gap-4 p-6 xl:p-9 text-white">
        {/* Floating Translucent Information Card (Upper Right) */}
        <div className="flex justify-end">
          <div className="max-w-[270px] xl:max-w-[300px] backdrop-blur-md bg-white/15 border border-white/25 rounded-2xl p-4 xl:p-5 text-white shadow-2xl transition-all duration-500 animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-200">
                Insight
              </span>
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-cyan-200 shadow-inner">
                {activeSlide.badgeIcon === 'heart' ? (
                  <Heart className="w-4 h-4 fill-cyan-300 text-cyan-300" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-cyan-300" />
                )}
              </div>
            </div>
            <h4 className="text-sm xl:text-base font-bold text-white mb-1.5 tracking-tight">
              {activeSlide.floatingTitle}
            </h4>
            <p className="text-xs text-slate-100/90 leading-relaxed font-normal">
              {activeSlide.floatingDesc}
            </p>
          </div>
        </div>

        {/* Bottom Editorial Content Area */}
        <div className="text-white">
          <div className="space-y-2 mb-5 max-w-lg">
            <h3 className="text-2xl xl:text-3xl font-extrabold tracking-tight text-white leading-tight drop-shadow-md">
              {activeSlide.headline}
            </h3>
            <p className="text-sm xl:text-base text-slate-200 leading-relaxed drop-shadow-sm font-normal">
              "{activeSlide.tagline}"
            </p>
          </div>

          {/* Carousel Slide Indicators & Functional Navigation Controls */}
          <div className="flex items-center justify-between pt-3 border-t border-white/20">
            <div className="flex items-center space-x-2">
              {SLIDES.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentSlideIndex(idx)}
                  aria-label={`Go to slide ${idx + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === currentSlideIndex
                      ? 'w-7 bg-cyan-400'
                      : 'w-2 bg-white/40 hover:bg-white/60'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={prevSlide}
                aria-label="Previous slide"
                className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/30 border border-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={nextSlide}
                aria-label="Next slide"
                className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/30 border border-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
