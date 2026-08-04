import { useEffect, useRef, useState } from 'react';
import { Globe, Check } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function LanguageSwitcher({ className = '' }) {
  const { language, setLanguage, languages } = useLanguage();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const current = languages.find((l) => l.code === language) || languages[0];

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-400 hover:text-white border border-gray-800 hover:border-gray-700 rounded-xl transition-all cursor-pointer"
      >
        <Globe size={14} />
        <span>{current.label}</span>
      </button>

      {open && (
        <div className="absolute end-0 mt-2 w-44 max-h-80 overflow-y-auto bg-[#0c101b] border border-gray-800 rounded-xl shadow-2xl z-50 py-1.5">
          {languages.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => {
                setLanguage(lang.code);
                setOpen(false);
              }}
              className={`w-full flex items-center justify-between gap-2 px-3.5 py-2 text-sm text-start hover:bg-gray-900/70 transition-colors cursor-pointer ${
                lang.code === language ? 'text-purple-400 font-semibold' : 'text-gray-300'
              }`}
            >
              <span>{lang.name}</span>
              {lang.code === language && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
