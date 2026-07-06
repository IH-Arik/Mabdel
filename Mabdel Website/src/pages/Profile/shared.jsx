import { Loader2 } from 'lucide-react';
export const INPUT = 'w-full px-4 py-3 bg-[#0A1019] border border-[#243246] text-white rounded-xl outline-none focus:border-[#11C7E5]/50 transition-colors text-sm placeholder:text-[#4A5568]';
export const LABEL = 'block text-[#A4B0B7] text-xs font-semibold uppercase tracking-wider mb-1.5';
export function Field({ label, children }) { return <div><label className={LABEL}>{label}</label>{children}</div>; }
export function Badge({ children, color='cyan' }) {
  const p = { cyan:'bg-[#11C7E5]/10 text-[#11C7E5] border-[#11C7E5]/20', green:'bg-emerald-950/30 text-emerald-400 border-emerald-500/20', yellow:'bg-amber-950/30 text-amber-400 border-amber-500/20', red:'bg-rose-950/30 text-rose-400 border-rose-500/20' };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${p[color]}`}>{children}</span>;
}
export function StatCard({ label, value, sub, icon: Icon, accent='#11C7E5' }) {
  return (
    <div className="bg-[#0A1019] border border-[#243041] rounded-2xl p-5 flex items-start gap-4">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{background:`${accent}18`}}>
        <Icon size={20} style={{color:accent}}/>
      </div>
      <div>
        <p className="text-[#A4B0B7] text-xs">{label}</p>
        <p className="text-2xl font-black text-white mt-0.5">{value}</p>
        {sub && <p className="text-[#A4B0B7] text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
