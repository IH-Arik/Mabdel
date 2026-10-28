export default function SectionCard({ icon: Icon, title, description, children }) {
  return (
    <div className="bg-[#0A1019] border border-[#243041] rounded-2xl p-5">
      <h3 className="font-bold text-white mb-1 flex items-center gap-2">
        <Icon size={16} className="text-[#9333ea]" />{title}
      </h3>
      {description ? <p className="text-[#A4B0B7] text-xs mb-3">{description}</p> : <div className="mb-3" />}
      {children}
    </div>
  );
}
