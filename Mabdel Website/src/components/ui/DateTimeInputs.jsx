import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parse,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, X } from 'lucide-react';

const BASE_INPUT =
  'w-full px-4 py-3 bg-[#0A1019] border border-[#243246] text-white rounded-xl outline-none transition-colors text-sm placeholder:text-[#4A5568]';

function useOutsideClose(open, onClose, refs) {
  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      const clickedInside = refs.some((ref) => ref.current && ref.current.contains(event.target));
      if (!clickedInside) onClose?.();
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') onClose?.();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose, open, refs]);
}

function buildTimeSlots(stepMinutes = 30) {
  const slots = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (let minute = 0; minute < 60; minute += stepMinutes) {
      const value = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      const label = format(parse(value, 'HH:mm', new Date()), 'hh:mm a');
      slots.push({ value, label });
    }
  }
  return slots;
}

const TIME_SLOTS = buildTimeSlots(30);

function PickerModal({ open, onClose, title, subtitle, children, widthClass = 'max-w-[360px]' }) {
  const panelRef = useRef(null);
  useOutsideClose(open, onClose, [panelRef]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#02080B]/75 px-4 backdrop-blur-sm">
      <div
        ref={panelRef}
        className={`w-full ${widthClass} rounded-[28px] border border-[#243041] bg-[#131A24] shadow-2xl shadow-black/40`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#243041]/50 px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-white">{title}</h3>
            {subtitle ? <p className="mt-1 text-xs text-[#8DA0B8]">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#243041] bg-[#101826] text-slate-300 transition-colors hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function CalendarGrid({ value, onSelect }) {
  const initialMonth = useMemo(() => {
    if (!value) return startOfMonth(new Date());
    const parsed = parse(value, 'yyyy-MM-dd', new Date());
    return Number.isNaN(parsed.getTime()) ? startOfMonth(new Date()) : startOfMonth(parsed);
  }, [value]);

  const [currentMonth, setCurrentMonth] = useState(initialMonth);

  useEffect(() => {
    setCurrentMonth(initialMonth);
  }, [initialMonth]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const selectedDate = value ? parse(value, 'yyyy-MM-dd', new Date()) : null;

  return (
    <div className="rounded-2xl border border-[#243041] bg-[#0A1019] p-4">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCurrentMonth((month) => subMonths(month, 1))}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#243041] bg-[#101826] text-slate-300 transition-colors hover:text-white"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="text-sm font-bold text-white">{format(currentMonth, 'MMMM yyyy')}</div>
        <button
          type="button"
          onClick={() => setCurrentMonth((month) => addMonths(month, 1))}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#243041] bg-[#101826] text-slate-300 transition-colors hover:text-white"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase tracking-wider text-[#7D8CA3]">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="py-1">{day}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dayValue = format(day, 'yyyy-MM-dd');
          const active = selectedDate && isSameDay(day, selectedDate);
          const muted = !isSameMonth(day, currentMonth);
          return (
            <button
              key={dayValue}
              type="button"
              onClick={() => onSelect(dayValue)}
              className={`h-10 rounded-xl text-sm font-semibold transition-all ${
                active
                  ? 'bg-[#11C7E5] text-[#03131B] shadow-md shadow-[#11C7E5]/20'
                  : muted
                  ? 'text-[#546274] hover:bg-[#101826]'
                  : 'text-white hover:bg-[#101826]'
              }`}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TimeList({ value, onSelect }) {
  const activeRef = useRef(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [value]);

  return (
    <div className="rounded-2xl border border-[#243041] bg-[#0A1019] p-4">
      <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#7D8CA3]">
        <Clock3 size={14} />
        Select time
      </div>
      <div className="mb-4 rounded-2xl border border-[#1D2B3D] bg-[#101826] p-4 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#7D8CA3]">Chosen time</p>
        <p className="mt-2 text-3xl font-black tracking-tight text-[#7DDEFF]">
          {value ? format(parse(value, 'HH:mm', new Date()), 'hh:mm a') : '--:--'}
        </p>
      </div>
      <div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto pr-1">
        {TIME_SLOTS.map((slot) => {
          const active = slot.value === value;
          return (
            <button
              key={slot.value}
              ref={active ? activeRef : null}
              type="button"
              onClick={() => onSelect(slot.value)}
              className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all ${
                active
                  ? 'border-[#11C7E5] bg-gradient-to-r from-[#123549] to-[#0E2433] text-[#B8F2FF] shadow-lg shadow-[#11C7E5]/10'
                  : 'border-[#243041] bg-[#101826] text-slate-300 hover:border-[#11C7E5]/30 hover:text-white'
              }`}
            >
              <span className="block text-base font-bold">{slot.label}</span>
              <span className={`mt-0.5 block text-[10px] uppercase tracking-[0.18em] ${active ? 'text-[#76D8EB]' : 'text-[#708198]'}`}>
                {slot.value}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DatePickerInput({
  value,
  onChange,
  placeholder = 'Select date',
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const popoverRef = useRef(null);
  useOutsideClose(open, () => setOpen(false), [wrapperRef, popoverRef]);

  const displayValue = value
    ? format(parse(value, 'yyyy-MM-dd', new Date()), 'MM/dd/yyyy')
    : '';

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`${BASE_INPUT} ${className} flex items-center justify-between gap-3 text-left ${
          open ? 'border-[#11C7E5]/50' : ''
        }`}
      >
        <span className={displayValue ? 'text-white font-semibold' : 'text-[#4A5568]'}>{displayValue || placeholder}</span>
        <CalendarDays size={16} className="text-[#7DDEFF]" />
      </button>

      <PickerModal
        open={open}
        onClose={() => setOpen(false)}
        title="Select date"
        subtitle="Choose a day from the calendar."
        widthClass="max-w-[360px]"
      >
        <CalendarGrid
          value={value}
          onSelect={(nextValue) => {
            onChange?.(nextValue);
            setOpen(false);
          }}
        />
      </PickerModal>
    </div>
  );
}

export function TimePickerInput({
  value,
  onChange,
  placeholder = 'Select time',
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  useOutsideClose(open, () => setOpen(false), [wrapperRef]);

  const displayValue = value
    ? format(parse(value, 'HH:mm', new Date()), 'hh:mm a')
    : '';

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`${BASE_INPUT} ${className} flex items-center justify-between gap-3 text-left ${
          open ? 'border-[#11C7E5]/50' : ''
        }`}
      >
        <span className={displayValue ? 'text-white font-semibold' : 'text-[#4A5568]'}>{displayValue || placeholder}</span>
        <Clock3 size={16} className="text-[#7DDEFF]" />
      </button>

      <PickerModal
        open={open}
        onClose={() => setOpen(false)}
        title="Select time"
        subtitle="Pick a start or end time from the list."
        widthClass="max-w-[420px]"
      >
        <TimeList
          value={value}
          onSelect={(nextValue) => {
            onChange?.(nextValue);
            setOpen(false);
          }}
        />
      </PickerModal>
    </div>
  );
}

export function DateTimePickerInput({
  value,
  onChange,
  placeholder = 'Select date and time',
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  useOutsideClose(open, () => setOpen(false), [wrapperRef]);

  const parsedValue = useMemo(() => {
    if (!value) return null;
    const parsed = parse(value, "yyyy-MM-dd'T'HH:mm", new Date());
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [value]);

  const [draftDate, setDraftDate] = useState(parsedValue ? format(parsedValue, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
  const [draftTime, setDraftTime] = useState(parsedValue ? format(parsedValue, 'HH:mm') : '10:00');

  useEffect(() => {
    if (!parsedValue) return;
    setDraftDate(format(parsedValue, 'yyyy-MM-dd'));
    setDraftTime(format(parsedValue, 'HH:mm'));
  }, [parsedValue]);

  const displayValue = parsedValue ? format(parsedValue, 'MM/dd/yyyy • hh:mm a') : '';

  const commit = (nextDate, nextTime) => {
    const finalValue = `${nextDate}T${nextTime}`;
    setDraftDate(nextDate);
    setDraftTime(nextTime);
    onChange?.(finalValue);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`${BASE_INPUT} ${className} flex items-center justify-between gap-3 text-left ${
          open ? 'border-[#11C7E5]/50' : ''
        }`}
      >
        <span className={displayValue ? 'text-white font-semibold' : 'text-[#4A5568]'}>{displayValue || placeholder}</span>
        <div className="flex items-center gap-2 text-[#7DDEFF]">
          <CalendarDays size={16} />
          <Clock3 size={16} />
        </div>
      </button>

      <PickerModal
        open={open}
        onClose={() => setOpen(false)}
        title="Select date and time"
        subtitle="Set both the day and the time for this action."
        widthClass="max-w-[760px]"
      >
        <div className="grid gap-4 md:grid-cols-[1.05fr_0.95fr]">
          <CalendarGrid value={draftDate} onSelect={(nextDate) => commit(nextDate, draftTime)} />
          <TimeList value={draftTime} onSelect={(nextTime) => commit(draftDate, nextTime)} />
        </div>
      </PickerModal>
    </div>
  );
}
