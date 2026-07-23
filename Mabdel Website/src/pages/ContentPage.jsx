import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { smartflowApi } from '../api/services';
import logoMark from '../assets/gocustify-mark.png';

const PAGE_META = {
  'privacy-policy': { request: () => smartflowApi.getPrivacyPolicy(), eyebrow: 'Legal' },
  'terms-and-conditions': {
    request: () => smartflowApi.getTermsAndConditions(),
    eyebrow: 'Legal',
    mergeWith: [{ request: () => smartflowApi.getAcceptableUsePolicy(), eyebrow: 'Usage' }],
  },
  'sms-messaging-policy': { request: () => smartflowApi.getSmsMessagingPolicy(), eyebrow: 'Messaging' },
  'acceptable-use-policy': { request: () => smartflowApi.getAcceptableUsePolicy(), eyebrow: 'Usage' },
  'about-us': { request: () => smartflowApi.getAboutUs(), eyebrow: 'Company' },
  'help-support': { request: () => smartflowApi.getHelpSupportContent(), eyebrow: 'Support' },
};

function formatUpdatedLabel(updatedAt) {
  if (!updatedAt) return '';
  try {
    return new Date(updatedAt).toLocaleDateString();
  } catch {
    return '';
  }
}

export default function ContentPage({ forcedSlug = '' }) {
  const { slug: routeSlug } = useParams();
  const slug = forcedSlug || routeSlug || '';
  const navigate = useNavigate();
  const [page, setPage] = useState(null);
  const [extraSections, setExtraSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const config = PAGE_META[slug] || { request: () => smartflowApi.getContentPage(slug), eyebrow: 'Content' };

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError('');

    const mergeWith = config.mergeWith || [];
    Promise.all([config.request(), ...mergeWith.map((extra) => extra.request())])
      .then(([mainResponse, ...extraResponses]) => {
        if (ignore) return;
        setPage(mainResponse?.data?.data || null);
        setExtraSections(
          extraResponses
            .map((response, index) => ({ eyebrow: mergeWith[index].eyebrow, content: response?.data?.data || null }))
            .filter((section) => section.content)
        );
      })
      .catch((loadError) => {
        if (!ignore) setError(loadError?.response?.data?.message || 'Could not load this page.');
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [config, slug]);

  const updatedLabel = useMemo(() => formatUpdatedLabel(page?.updated_at), [page?.updated_at]);

  return (
    <div className="min-h-screen bg-[#070a13] text-gray-100">
      <header className="border-b border-gray-900 bg-[#070a13]/95 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 text-sm font-semibold text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Home
          </button>

          <div className="flex items-center gap-2">
            <img src={logoMark} alt="GoCustify logo" className="w-9 h-9 rounded-lg shadow-lg shadow-cyan-500/20" />
            <span className="text-lg font-bold tracking-tight text-white">GoCustify</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-16 md:py-20">
        {loading ? (
          <div className="min-h-[40vh] flex items-center justify-center">
            <Loader2 className="animate-spin text-cyan-400" />
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-rose-500/20 bg-rose-950/10 px-6 py-8 text-rose-300">{error}</div>
        ) : page ? (
          <div className="space-y-10">
            <div className="space-y-5">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-400">{config.eyebrow}</p>
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white">{page.title}</h1>
              {updatedLabel ? <p className="text-sm text-gray-500">Updated {updatedLabel}</p> : null}
            </div>

            <div className="space-y-8 rounded-[28px] border border-gray-900 bg-[#0c101b]/80 px-6 py-7 md:px-8 md:py-9">
              {page.blocks?.map((block) => (
                <section key={`${block.order}-${block.heading || 'body'}`} className="space-y-3">
                  {block.heading ? <h2 className="text-xl font-bold text-white tracking-tight">{block.heading}</h2> : null}
                  <div className="whitespace-pre-wrap text-[15px] leading-8 text-gray-300">{block.body}</div>
                </section>
              ))}
            </div>

            {extraSections.map((section) => (
              <div key={section.content.slug || section.content.title} className="space-y-8 pt-4 border-t border-gray-900">
                <div className="space-y-5">
                  <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-400">{section.eyebrow}</p>
                  <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white">{section.content.title}</h1>
                  {formatUpdatedLabel(section.content.updated_at) ? (
                    <p className="text-sm text-gray-500">Updated {formatUpdatedLabel(section.content.updated_at)}</p>
                  ) : null}
                </div>

                <div className="space-y-8 rounded-[28px] border border-gray-900 bg-[#0c101b]/80 px-6 py-7 md:px-8 md:py-9">
                  {section.content.blocks?.map((block) => (
                    <section key={`${block.order}-${block.heading || 'body'}`} className="space-y-3">
                      {block.heading ? <h2 className="text-xl font-bold text-white tracking-tight">{block.heading}</h2> : null}
                      <div className="whitespace-pre-wrap text-[15px] leading-8 text-gray-300">{block.body}</div>
                    </section>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </main>
    </div>
  );
}
