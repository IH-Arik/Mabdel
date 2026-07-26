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

const FACE_RADIUS = 100;
const TICK_RADIUS = 80;

const HOUR_TICKS = Array.from({ length: 12 }, (_, i) => ({
  value: i === 0 ? 12 : i,
  angle: i * 30,
}));

const MINUTE_TICKS = Array.from({ length: 12 }, (_, i) => ({
  value: i * 5,
  angle: i * 30,
}));

function polarPoint(radius, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: radius * Math.cos(rad), y: radius * Math.sin(rad) };
}

function angleFromCenter(centerX, centerY, x, y) {
  const dx = x - centerX;
  const dy = y - centerY;
  let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
  if (angle < 0) angle += 360;
  return angle;
}

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

function AnalogTimePicker({ value, onSelect, onDone }) {
  const initial = useMemo(() => {
    if (!value) return { hour24: 10, minute: 0 };
    const parsed = parse(value, 'HH:mm', new Date());
    if (Number.isNaN(parsed.getTime())) return { hour24: 10, minute: 0 };
    return { hour24: parsed.getHours(), minute: parsed.getMinutes() };
  }, [value]);

  const [mode, setMode] = useState('hour');
  const [hour12, setHour12] = useState(() => {
    const h = initial.hour24 % 12;
    return h === 0 ? 12 : h;
  });
  const [minute, setMinute] = useState(initial.minute);
  const [isPM, setIsPM] = useState(initial.hour24 >= 12);
  const [dragging, setDragging] = useState(false);
  const faceRef = useRef(null);

  useEffect(() => {
    const h = initial.hour24 % 12;
    setHour12(h === 0 ? 12 : h);
    setMinute(initial.minute);
    setIsPM(initial.hour24 >= 12);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const commitValue = (nextHour12, nextMinute, nextIsPM) => {
    let hour24 = nextHour12 % 12;
    if (nextIsPM) hour24 += 12;
    onSelect(`${String(hour24).padStart(2, '0')}:${String(nextMinute).padStart(2, '0')}`);
  };

  const handlePointerAt = (clientX, clientY) => {
    const face = faceRef.current;
    if (!face) return;
    const rect = face.getBoundingClientRect();
    const angle = angleFromCenter(rect.left + rect.width / 2, rect.top + rect.height / 2, clientX, clientY);
    const idx = Math.round(angle / 30) % 12;
    if (mode === 'hour') {
      const nextHour = idx === 0 ? 12 : idx;
      setHour12(nextHour);
      commitValue(nextHour, minute, isPM);
    } else {
      const nextMinute = (idx * 5) % 60;
      setMinute(nextMinute);
      commitValue(hour12, nextMinute, isPM);
    }
  };

  useEffect(() => {
    if (!dragging) return undefined;
    const onMove = (event) => {
      const point = event.touches ? event.touches[0] : event;
      handlePointerAt(point.clientX, point.clientY);
    };
    const onUp = () => {
      setDragging(false);
      if (mode === 'hour') {
        setMode('minute');
      } else {
        onDone?.();
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging, mode, hour12, minute, isPM]);

  const selectedAngle = mode === 'hour' ? (hour12 % 12) * 30 : (minute / 5) * 30;
  const knobPoint = polarPoint(TICK_RADIUS, selectedAngle);
  const ticks = mode === 'hour' ? HOUR_TICKS : MINUTE_TICKS;
  const activeValue = mode === 'hour' ? hour12 : minute;

  return (
    <div className="rounded-2xl border border-[#243041] bg-[#0A1019] p-4">
      <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#7D8CA3]">
        <Clock3 size={14} />
        Select time
      </div>

      <div className="mb-5 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setMode('hour')}
          className={`rounded-xl px-3 py-1.5 text-3xl font-black tracking-tight transition-colors ${
            mode === 'hour' ? 'bg-[#123549] text-[#7DDEFF]' : 'text-slate-400 hover:text-white'
          }`}
        >
          {String(hour12).padStart(2, '0')}
        </button>
        <span className="text-3xl font-black text-[#7DDEFF]">:</span>
        <button
          type="button"
          onClick={() => setMode('minute')}
          className={`rounded-xl px-3 py-1.5 text-3xl font-black tracking-tight transition-colors ${
            mode === 'minute' ? 'bg-[#123549] text-[#7DDEFF]' : 'text-slate-400 hover:text-white'
          }`}
        >
          {String(minute).padStart(2, '0')}
        </button>
        <div className="ml-2 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => { setIsPM(false); commitValue(hour12, minute, false); }}
            className={`rounded-lg px-2 py-1 text-xs font-bold transition-colors ${
              !isPM ? 'bg-[#11C7E5] text-[#03131B]' : 'bg-[#101826] text-slate-400'
            }`}
          >
            AM
          </button>
          <button
            type="button"
            onClick={() => { setIsPM(true); commitValue(hour12, minute, true); }}
            className={`rounded-lg px-2 py-1 text-xs font-bold transition-colors ${
              isPM ? 'bg-[#11C7E5] text-[#03131B]' : 'bg-[#101826] text-slate-400'
            }`}
          >
            PM
          </button>
        </div>
      </div>

      <div className="flex justify-center pb-1">
        <div
          ref={faceRef}
          onPointerDown={(event) => {
            event.preventDefault();
            setDragging(true);
            handlePointerAt(event.clientX, event.clientY);
          }}
          className="relative select-none rounded-full border border-[#1D2B3D] bg-[#101826]"
          style={{ width: FACE_RADIUS * 2, height: FACE_RADIUS * 2, touchAction: 'none', cursor: 'pointer' }}
        >
          <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#11C7E5]" />

          <div
            className="pointer-events-none absolute left-1/2 top-1/2 bg-[#11C7E5]/60"
            style={{
              width: 2,
              height: TICK_RADIUS,
              transformOrigin: 'top center',
              transform: `translateX(-50%) rotate(${selectedAngle + 180}deg)`,
            }}
          />

          <div
            className="pointer-events-none absolute h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#11C7E5]"
            style={{ left: FACE_RADIUS + knobPoint.x, top: FACE_RADIUS + knobPoint.y }}
          />

          {ticks.map((tick) => {
            const point = polarPoint(TICK_RADIUS, tick.angle);
            const active = tick.value === activeValue;
            return (
              <div
                key={tick.value}
                className={`pointer-events-none absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center text-sm font-bold ${
                  active ? 'text-[#03131B]' : 'text-slate-300'
                }`}
                style={{ left: FACE_RADIUS + point.x, top: FACE_RADIUS + point.y }}
              >
                {mode === 'minute' ? String(tick.value).padStart(2, '0') : tick.value}
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-3 text-center text-[11px] text-[#7D8CA3]">
        {mode === 'hour' ? 'Tap or drag to set the hour' : 'Tap or drag to set the minutes'}
      </p>
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
        <AnalogTimePicker
          value={value}
          onSelect={(nextValue) => onChange?.(nextValue)}
          onDone={() => {
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
          <AnalogTimePicker value={draftTime} onSelect={(nextTime) => commit(draftDate, nextTime)} />
        </div>
      </PickerModal>
    </div>
  );
}
