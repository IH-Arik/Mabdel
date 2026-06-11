import { useEffect, useRef, useState } from "react";
import JoditEditor from "jodit-react";
import { Link } from "react-router-dom";
import { FaArrowLeftLong } from "react-icons/fa6";
import { getTermsAndConditions, upsertTermsAndConditions } from "../../../services/cmsApi";

const TermsCondition = () => {
  const editor = useRef(null);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const payload = await getTermsAndConditions();
        if (!mounted) return;
        const data = payload?.data || payload;
        setContent(data?.content || data?.description || "");
      } catch {
        if (mounted) setContent("");
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      await upsertTermsAndConditions({ content });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen mx-auto ">
      <Link to="/" className="flex items-center mt-16 mb-6 text-white gap-x-3">
        <FaArrowLeftLong size={20} />
        <h1 className="text-2xl font-semibold ">Terms Condition</h1>
      </Link>
      <div>
        <JoditEditor
          ref={editor}
          value={content}
          config={{ readonly: false, placeholder: "Start typing...", height: 600, iframe: false }}
          tabIndex={1}
          onBlur={(newContent) => setContent(newContent)}
          onChange={() => {}}
        />
        <div className="text-center">
          <button onClick={handleSave} disabled={saving} className="bg-[#319FCA] p-2 text-white mt-2 rounded-lg disabled:opacity-60">
            {saving ? "Saving..." : "Save Change"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TermsCondition;
