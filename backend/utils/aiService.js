const Message = require('../models/Message');

const GROQ_API_KEY = String(process.env.GROQ_API_KEY || '').trim();
const GROQ_MODEL = String(process.env.GROQ_MODEL || 'llama-3.3-70b-versatile').trim();
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_PROMPT = 'Please respond to the latest message in this conversation.';
const HISTORY_LIMIT = 12;
const REQUEST_TIMEOUT_MS = 20000;
const SYSTEM_INSTRUCTION = [
  'You are NexChat AI, a helpful assistant inside a real-time messaging app.',
  'Reply naturally, briefly, and helpfully unless the user clearly asks for detail.',
  'Use the supplied chat history as context.',
  'If the context is incomplete, say so instead of inventing details.',
  'You only know attachments through the summaries provided in the transcript.',
].join(' ');

const hasConfiguredGroqKey =
  Boolean(GROQ_API_KEY) &&
  !/^your_/i.test(GROQ_API_KEY) &&
  !/replace_me/i.test(GROQ_API_KEY);

const safeTrim = (value) => (typeof value === 'string' ? value.trim() : '');

const buildMissingConfigMessage = () =>
  'Groq is not configured yet. Add a real GROQ_API_KEY in backend/.env and restart the backend.';

const describeLocation = (location = {}) => {
  const address = safeTrim(location.address);
  const hasCoords = Number.isFinite(location.lat) && Number.isFinite(location.lng);

  if (address && hasCoords) {
    return `[Location] ${address} (${location.lat}, ${location.lng})`;
  }

  if (address) {
    return `[Location] ${address}`;
  }

  if (hasCoords) {
    return `[Location] ${location.lat}, ${location.lng}`;
  }

  return '[Location shared]';
};

const describePoll = (poll = {}) => {
  const question = safeTrim(poll.question) || 'Untitled poll';
  const options = Array.isArray(poll.options)
    ? poll.options
        .map((option) => safeTrim(option?.text || option))
        .filter(Boolean)
        .join(', ')
    : '';

  return options ? `[Poll] ${question} Options: ${options}` : `[Poll] ${question}`;
};

const describeMedia = (message = {}) => {
  const labelByType = {
    image: 'Image',
    video: 'Video',
    audio: 'Audio',
    document: 'Document',
  };

  const label = labelByType[message.messageType] || 'Attachment';
  const text = safeTrim(message.content);
  const mediaType = safeTrim(message.mediaType);

  if (text) {
    return `[${label}] ${text}`;
  }

  if (mediaType) {
    return `[${label}] ${mediaType}`;
  }

  return `[${label} shared]`;
};

const describeMessage = (message = {}) => {
  if (message.isDeletedForEveryone) {
    return '';
  }

  const content = safeTrim(message.content);

  switch (message.messageType) {
    case 'image':
    case 'video':
    case 'audio':
    case 'document':
      return describeMedia(message);
    case 'location':
      return describeLocation(message.location);
    case 'poll':
      return describePoll(message.poll);
    case 'ai':
    case 'text':
    default:
      return content;
  }
};

const toTranscriptEntry = (message = {}) => {
  const summary = describeMessage(message);
  if (!summary) return null;

  if (message.messageType === 'ai') {
    return {
      role: 'assistant',
      content: summary,
    };
  }

  const senderName = safeTrim(message?.senderId?.name) || 'User';

  return {
    role: 'user',
    content: `${senderName}: ${summary}`,
  };
};

const loadConversationHistory = async (chatId) => {
  if (!chatId) return [];

  try {
    const messages = await Message.find({
      chatId,
      isSent: true,
      isDeletedForEveryone: false,
    })
      .sort({ createdAt: -1 })
      .limit(HISTORY_LIMIT)
      .populate('senderId', 'name')
      .lean();

    return messages.reverse();
  } catch (error) {
    console.error('Failed to load AI conversation history:', error.message);
    return [];
  }
};

const buildGroqMessages = (history, prompt) => {
  const transcript = Array.isArray(history)
    ? history.map(toTranscriptEntry).filter(Boolean)
    : [];
  const normalizedPrompt = safeTrim(prompt) || DEFAULT_PROMPT;

  return [
    {
      role: 'system',
      content: SYSTEM_INSTRUCTION,
    },
    ...transcript,
    {
      role: 'user',
      content: `Reply to the latest request from this chat.\nLatest request: ${normalizedPrompt}`,
    },
  ];
};

const parseGroqResponse = (payload = {}) => safeTrim(payload?.choices?.[0]?.message?.content);

const readJsonSafely = async (response) => {
  const raw = await response.text();

  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch (error) {
    return { raw };
  }
};

const buildProviderErrorMessage = (providerMessage = '') => {
  if (/rate limit|quota|billing|credits|capacity/i.test(providerMessage)) {
    return 'Groq is connected, but this key or project hit a limit right now. Check your Groq rate limits, credits, or plan and try again.';
  }

  if (/api key/i.test(providerMessage)) {
    return 'Groq rejected the API key. Check GROQ_API_KEY in backend/.env and restart the backend.';
  }

  if (/model permission|restricted|forbidden|model/i.test(providerMessage) || /not found/i.test(providerMessage)) {
    return 'Groq could not use the configured model. Set GROQ_MODEL to an allowed model like llama-3.3-70b-versatile and restart the backend.';
  }

  return 'I could not reach Groq just now. Please try again in a moment.';
};

const requestGroq = async (messages) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: 0.7,
        max_completion_tokens: 500,
      }),
      signal: controller.signal,
    });

    const payload = await readJsonSafely(response);

    if (!response.ok) {
      const providerMessage =
        safeTrim(payload?.error?.message) ||
        safeTrim(payload?.raw) ||
        response.statusText ||
        `HTTP ${response.status}`;
      console.error('Groq API error:', providerMessage);
      return buildProviderErrorMessage(providerMessage);
    }

    const text = parseGroqResponse(payload);

    if (!text) {
      return 'Groq did not return a text response. Please try again.';
    }

    return text;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('Groq request timed out');
      return 'Groq took too long to respond. Please try again.';
    }

    console.error('Groq request failed:', error.message);
    return 'I could not reach Groq just now. Please try again in a moment.';
  } finally {
    clearTimeout(timeout);
  }
};

const getAIResponse = async (prompt, chatId) => {
  if (!hasConfiguredGroqKey) {
    return buildMissingConfigMessage();
  }

  const history = await loadConversationHistory(chatId);
  const messages = buildGroqMessages(history, prompt);
  return requestGroq(messages);
};

module.exports = {
  getAIResponse,
};
