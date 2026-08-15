import React from 'react';

export function ConversationSkeletonList({ count = 6 }) {
  return (
    <div className="divide-y divide-[#243041]/20">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 p-4 animate-pulse transition-opacity"
          style={{ animationDelay: `${index * 120}ms` }}
        >
          {/* Avatar circle skeleton */}
          <div className="h-11 w-11 shrink-0 rounded-xl bg-slate-800/80 border border-slate-700/30 shadow-inner" />
          
          <div className="min-w-0 flex-1 space-y-2">
            {/* Contact Name & Time */}
            <div className="flex items-center justify-between gap-2">
              <div
                className="h-3.5 rounded bg-slate-800/90"
                style={{ width: `${(index % 3) * 15 + 45}%` }}
              />
              <div className="h-2.5 w-10 rounded bg-slate-800/60" />
            </div>
            
            {/* Platform Badge & Message Preview */}
            <div className="flex items-center gap-2">
              <div className="h-4 w-12 rounded-md bg-purple-950/50 border border-purple-500/30" />
              <div
                className="h-3 rounded bg-slate-800/60 flex-1"
                style={{ maxWidth: `${(index % 4) * 20 + 100}px` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function MessagesThreadSkeleton() {
  return (
    <div className="space-y-6 p-2 animate-pulse">
      {/* Date badge skeleton */}
      <div className="flex justify-center my-4">
        <div className="h-5 w-28 rounded-full bg-slate-800/60 border border-slate-700/30" />
      </div>

      {/* Inbound message 1 */}
      <div className="flex items-start gap-3 justify-start">
        <div className="h-8 w-8 shrink-0 rounded-lg bg-slate-800/80 border border-slate-700/40" />
        <div className="max-w-[70%] space-y-2 rounded-2xl rounded-tl-none border border-[#243041]/40 bg-[#121625]/60 p-4 shadow-sm">
          <div className="h-3.5 w-48 rounded bg-slate-700/70" />
          <div className="h-3.5 w-32 rounded bg-slate-700/50" />
          <div className="flex justify-end pt-1">
            <div className="h-2 w-10 rounded bg-slate-800/60" />
          </div>
        </div>
      </div>

      {/* Outbound message 1 */}
      <div className="flex justify-end">
        <div className="max-w-[70%] space-y-2 rounded-2xl rounded-tr-none border border-[#9333ea]/30 bg-[#9333ea]/20 p-4 shadow-sm">
          <div className="h-3.5 w-56 rounded bg-[#c084fc]/40" />
          <div className="h-3.5 w-36 rounded bg-[#c084fc]/25" />
          <div className="flex justify-end pt-1">
            <div className="h-2 w-12 rounded bg-[#c084fc]/30" />
          </div>
        </div>
      </div>

      {/* Inbound message 2 with audio/attachment preview placeholder */}
      <div className="flex items-start gap-3 justify-start">
        <div className="h-8 w-8 shrink-0 rounded-lg bg-slate-800/80 border border-slate-700/40" />
        <div className="max-w-[70%] space-y-2.5 rounded-2xl rounded-tl-none border border-[#243041]/40 bg-[#121625]/60 p-4 shadow-sm">
          <div className="h-3.5 w-60 rounded bg-slate-700/70" />
          {/* Audio player placeholder */}
          <div className="h-9 w-48 rounded-xl bg-slate-800/70 border border-slate-700/30 flex items-center px-3 gap-2">
            <div className="h-5 w-5 rounded-full bg-purple-500/40" />
            <div className="h-2 flex-1 rounded bg-slate-700/50" />
          </div>
          <div className="flex justify-end pt-1">
            <div className="h-2 w-10 rounded bg-slate-800/60" />
          </div>
        </div>
      </div>

      {/* Outbound message 2 */}
      <div className="flex justify-end">
        <div className="max-w-[70%] space-y-2 rounded-2xl rounded-tr-none border border-[#9333ea]/30 bg-[#9333ea]/20 p-4 shadow-sm">
          <div className="h-3.5 w-44 rounded bg-[#c084fc]/40" />
          <div className="flex justify-end pt-1">
            <div className="h-2 w-10 rounded bg-[#c084fc]/30" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ConversationHeaderSkeleton() {
  return (
    <div className="flex items-center justify-between border-b border-[#243041]/40 bg-[#0c101b]/60 p-4 backdrop-blur-md animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-slate-800/80 border border-slate-700/30" />
        <div className="space-y-1.5">
          <div className="h-4 w-32 rounded bg-slate-800/80" />
          <div className="h-3 w-16 rounded bg-purple-950/50 border border-purple-500/20" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-xl bg-slate-800/60" />
        <div className="h-8 w-8 rounded-xl bg-slate-800/60" />
        <div className="h-8 w-8 rounded-xl bg-slate-800/60" />
      </div>
    </div>
  );
}
