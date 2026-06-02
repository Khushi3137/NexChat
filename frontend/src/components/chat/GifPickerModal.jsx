import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../shared/Modal';

const GIPHY_API_KEY = process.env.REACT_APP_GIPHY_API_KEY;
const GIPHY_API_BASE = 'https://api.giphy.com/v1/gifs';
const DEFAULT_LIMIT = 24;

const hasConfiguredGiphyKey = () =>
  Boolean(GIPHY_API_KEY) && !String(GIPHY_API_KEY).includes('your_');

const getGifPreviewUrl = (gif) =>
  gif?.images?.fixed_width?.webp
  || gif?.images?.fixed_width?.url
  || gif?.images?.downsized_medium?.url
  || gif?.images?.original?.url
  || '';

const getGifSendUrl = (gif) =>
  gif?.images?.downsized_medium?.url
  || gif?.images?.original?.url
  || gif?.images?.fixed_width?.url
  || '';

const GifPickerModal = ({ isOpen, onClose, onSelect }) => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setDebouncedQuery('');
      setResults([]);
      setError('');
      setLoading(false);
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [isOpen, query]);

  useEffect(() => {
    if (!isOpen || !hasConfiguredGiphyKey()) return undefined;

    const controller = new AbortController();
    const endpoint = debouncedQuery ? 'search' : 'trending';
    const params = new URLSearchParams({
      api_key: GIPHY_API_KEY,
      limit: String(DEFAULT_LIMIT),
      rating: 'g',
    });

    if (debouncedQuery) {
      params.set('q', debouncedQuery);
    }

    const loadGifs = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await fetch(`${GIPHY_API_BASE}/${endpoint}?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('Unable to load GIFs right now.');
        }

        const payload = await response.json();
        setResults(Array.isArray(payload?.data) ? payload.data : []);
      } catch (fetchError) {
        if (fetchError.name === 'AbortError') return;
        setResults([]);
        setError(fetchError.message || 'Unable to load GIFs right now.');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadGifs();

    return () => controller.abort();
  }, [debouncedQuery, isOpen]);

  const heading = useMemo(
    () => (debouncedQuery ? `Results for "${debouncedQuery}"` : 'Trending GIFs'),
    [debouncedQuery]
  );

  const handleSelect = async (gif) => {
    const mediaUrl = getGifSendUrl(gif);
    if (!mediaUrl) return;

    const didSend = await onSelect?.({
      content: '',
      messageType: 'image',
      mediaUrl,
    });

    if (didSend !== false) {
      onClose?.();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="GIF Picker"
      maxWidthClass="max-w-5xl"
      panelClassName="bg-[#0c0c14] p-0"
    >
      <div className="border-b border-white/8 px-5 py-4">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search GIFs"
          className="w-full rounded-2xl border border-white/10 bg-[#14141f] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#7c6aff]"
        />
      </div>

      {!hasConfiguredGiphyKey() ? (
        <div className="px-5 py-10 text-center">
          <div className="text-lg font-semibold text-white">GIF search needs a GIPHY API key</div>
          <div className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-white/58">
            Add `REACT_APP_GIPHY_API_KEY` to your frontend `.env`, restart the frontend, and this picker will load
            trending and searched GIFs inside the app.
          </div>
        </div>
      ) : (
        <div className="px-5 pb-5 pt-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-white/74">{heading}</div>
            <div className="text-[0.72rem] uppercase tracking-[0.12em] text-white/28">Powered by GIPHY</div>
          </div>

          {loading ? (
            <div className="rounded-3xl border border-white/8 bg-[#14141f] px-4 py-12 text-center text-sm text-white/52">
              Loading GIFs...
            </div>
          ) : null}

          {!loading && error ? (
            <div className="rounded-3xl border border-[#ff6b7a]/14 bg-[#ff6b7a]/8 px-4 py-12 text-center text-sm text-[#ffd2d7]">
              {error}
            </div>
          ) : null}

          {!loading && !error && !results.length ? (
            <div className="rounded-3xl border border-white/8 bg-[#14141f] px-4 py-12 text-center text-sm text-white/52">
              No GIFs found for that search.
            </div>
          ) : null}

          {!loading && !error && results.length ? (
            <div className="grid max-h-[65vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4">
              {results.map((gif) => {
                const previewUrl = getGifPreviewUrl(gif);
                if (!previewUrl) return null;

                return (
                  <button
                    key={gif.id}
                    type="button"
                    onClick={() => handleSelect(gif)}
                    className="group overflow-hidden rounded-3xl border border-white/8 bg-[#14141f] text-left transition hover:border-[#7c6aff]/24 hover:shadow-[0_16px_38px_rgba(124,106,255,0.14)]"
                  >
                    <div className="aspect-[4/4.8] overflow-hidden bg-[#101018]">
                      <img
                        src={previewUrl}
                        alt={gif.title || 'GIF'}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                      />
                    </div>
                    <div className="px-3 py-2 text-[0.74rem] text-white/48">
                      {(gif.title || 'GIF').slice(0, 42) || 'GIF'}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  );
};

export default GifPickerModal;
