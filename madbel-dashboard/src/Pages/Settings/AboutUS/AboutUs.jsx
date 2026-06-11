import { useEffect, useRef, useState } from "react";
import JoditEditor from "jodit-react";
import { FaArrowLeftLong } from "react-icons/fa6";
import { Link } from "react-router-dom";
import { getAboutUs, upsertAboutUs } from "../../../services/cmsApi";

const AboutUs = () => {
  const editor = useRef(null);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const payload = await getAboutUs();
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
      await upsertAboutUs({ content });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen mt-16 ">
      <Link to="/" className="flex items-center mt-16 mb-6 text-white gap-x-3">
        <FaArrowLeftLong size={20} />
        <h1 className="text-2xl font-semibold "> About Us</h1>
      </Link>
      <div className="mt-5">
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

export default AboutUs;
