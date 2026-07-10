import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Loader2, RefreshCw, Send, Sparkles } from 'lucide-react';
import { smartflowApi } from '../api/services';

const PLATFORM_OPTIONS = [
  { id: 'facebook', label: 'Facebook', accent: '#1877F2' },
  { id: 'instagram', label: 'Instagram', accent: '#E1306C' },
  { id: 'linkedin', label: 'LinkedIn', accent: '#0A66C2' },
  { id: 'x', label: 'X', accent: '#FFFFFF' },
  { id: 'threads', label: 'Threads', accent: '#D6D6D6' },
];

const INPUT = 'w-full px-4 py-3 bg-[#0A1019] border border-[#243246] text-white rounded-xl outline-none focus:border-[#11C7E5]/50 transition-colors text-sm placeholder:text-[#4A5568]';
const LABEL = 'block text-[#A4B0B7] text-xs font-semibold uppercase tracking-wider mb-1.5';

export default function CreatePost() {
  const [prompt, setPrompt] = useState('');
  const [content, setContent] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState(['facebook', 'linkedin']);
  const [scheduleDate, setScheduleDate] = useState('');
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [history, setHistory] = useState([]);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const characterCount = useMemo(() => content.trim().length, [content]);

  const loadHistory = async () => {
    try {
      const response = await smartflowApi.listSocialPosts({ page: 1, page_size: 5 });
      setHistory(response.data?.data?.items || response.data?.data || []);
    } catch {
      setHistory([]);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const togglePlatform = (platformId) => {
    setSelectedPlatforms((current) =>
      current.includes(platformId)
        ? current.filter((item) => item !== platformId)
        : [...current, platformId]
    );
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setFeedback({ type: 'error', message: 'Enter a prompt to generate your post.' });
      return;
    }

    setGenerating(true);
    setFeedback({ type: '', message: '' });
    try {
      const response = await smartflowApi.aiChat(prompt.trim(), { response_mode: 'text' });
      const generated =
        response.data?.data?.ai_message?.content ||
        response.data?.ai_message?.content ||
        response.data?.data?.response ||
        response.data?.response ||
        '';

      if (!generated) {
        throw new Error('No content returned from AI.');
      }

      setContent(generated);
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error.response?.data?.message || error.message || 'Could not generate post content.',
      });
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async (scheduled = false) => {
    if (!content.trim()) {
      setFeedback({ type: 'error', message: 'Write or generate content before publishing.' });
      return;
    }

    if (!selectedPlatforms.length) {
      setFeedback({ type: 'error', message: 'Select at least one platform.' });
      return;
    }

    if (scheduled && !scheduleDate) {
      setFeedback({ type: 'error', message: 'Choose a schedule date first.' });
      return;
    }

    setPublishing(true);
    setFeedback({ type: '', message: '' });
    try {
      const response = await smartflowApi.createSocialPost({
        content: content.trim(),
        platforms: selectedPlatforms,
        media_url: null,
        scheduled_at: scheduled ? new Date(scheduleDate).toISOString() : null,
      });
      const results = response.data?.data?.results || [];
      const successful = results.filter((item) => ['published', 'scheduled'].includes(item.status));
      const failed = results.filter((item) => !['published', 'scheduled'].includes(item.status));

      if (successful.length && !failed.length) {
        setFeedback({
          type: 'success',
          message: scheduled
            ? `Post scheduled for ${new Date(scheduleDate).toLocaleString()}.`
            : `Posted to ${successful.map((item) => item.platform).join(', ')}.`,
        });
      } else if (successful.length) {
        setFeedback({
          type: 'success',
          message: `Partial success. Posted to ${successful.map((item) => item.platform).join(', ')}.`,
        });
      } else {
        setFeedback({
          type: 'error',
          message: failed.map((item) => `${item.platform}: ${item.error || item.status}`).join(' | ') || 'Publishing failed.',
        });
      }

      loadHistory();
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error.response?.data?.message || 'Could not publish your post.',
      });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-[#243041]/40 pb-4">
        <div className="text-left">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Create Post</h1>
          <p className="text-[#A4B0B7] text-xs mt-1">Generate with AI, publish now, or schedule across connected social channels.</p>
        </div>
      </div>

      {feedback.message && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${feedback.type === 'error' ? 'border-rose-500/30 bg-rose-950/30 text-rose-300' : 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300'}`}>
          {feedback.message}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <div className="bg-[#131A24] border border-[#243041] rounded-[22px] p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-[#11C7E5]" />
              <h2 className="text-white font-bold">AI Generator</h2>
            </div>

            <div>
              <label className={LABEL}>Prompt</label>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Describe the post you want Mabdel AI to create..."
                className={`${INPUT} min-h-28 resize-none`}
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={generating || !prompt.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-[#11C7E5] px-4 py-3 text-sm font-extrabold text-[#02080B] transition-all disabled:cursor-not-allowed disabled:opacity-60"
            >
              {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              Generate Post
            </button>
          </div>

          <div className="bg-[#131A24] border border-[#243041] rounded-[22px] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold">Content</h2>
              <span className="text-xs font-semibold text-[#A4B0B7]">{characterCount} characters</span>
            </div>

            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Your final post content appears here..."
              className={`${INPUT} min-h-64 resize-none`}
            />

            <div>
              <label className={LABEL}>Platforms</label>
              <div className="flex flex-wrap gap-2">
                {PLATFORM_OPTIONS.map((platform) => {
                  const active = selectedPlatforms.includes(platform.id);
                  return (
                    <button
                      key={platform.id}
                      type="button"
                      onClick={() => togglePlatform(platform.id)}
                      className={`rounded-full border px-4 py-2 text-xs font-bold transition-all ${active ? 'border-[#11C7E5] bg-[#11C7E5]/10 text-white' : 'border-[#243246] bg-[#0A1019] text-[#A4B0B7]'}`}
                    >
                      <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: platform.accent }} />
                      {platform.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
              <div>
                <label className={LABEL}>Schedule Date</label>
                <input
                  type="datetime-local"
                  value={scheduleDate}
                  onChange={(event) => setScheduleDate(event.target.value)}
                  className={INPUT}
                />
              </div>

              <button
                type="button"
                onClick={() => handlePublish(false)}
                disabled={publishing}
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-[#11C7E5] px-4 py-3 text-sm font-extrabold text-[#02080B] transition-all disabled:cursor-not-allowed disabled:opacity-60"
              >
                {publishing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Publish Now
              </button>

              <button
                type="button"
                onClick={() => handlePublish(true)}
                disabled={publishing}
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl border border-[#243246] bg-[#0A1019] px-4 py-3 text-sm font-extrabold text-white transition-all disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CalendarClock size={16} />
                Schedule
              </button>
            </div>
          </div>
        </div>

        <div className="bg-[#131A24] border border-[#243041] rounded-[22px] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-bold">Recent Posts</h2>
            <button
              type="button"
              onClick={loadHistory}
              className="inline-flex items-center gap-2 text-xs font-bold text-[#11C7E5]"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>

          {history.length ? (
            <div className="space-y-3">
              {history.map((item) => (
                <div key={item.id} className="rounded-2xl border border-[#243041] bg-[#0A1019] p-4 text-left">
                  <p className="text-sm text-white line-clamp-4">{item.content}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(item.platforms || []).map((platform) => (
                      <span key={`${item.id}-${platform}`} className="rounded-full bg-[#12303F] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#11C7E5]">
                        {platform}
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 text-[11px] text-[#A4B0B7]">
                    {item.scheduled_at
                      ? `Scheduled for ${new Date(item.scheduled_at).toLocaleString()}`
                      : `Created ${new Date(item.created_at).toLocaleString()}`}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#243041] bg-[#0A1019] p-8 text-center text-sm text-[#A4B0B7]">
              No social posts yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
