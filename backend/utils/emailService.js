const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const stripHtml = (html = '') =>
  String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

const getSender = () => ({
  email: process.env.EMAIL_FROM,
  name: process.env.EMAIL_FROM_NAME || 'Nexus Chat',
});

const getReplyTo = () => process.env.EMAIL_REPLY_TO || process.env.EMAIL_FROM;

const freeEmailDomains = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'icloud.com',
  'aol.com',
]);

let deliverabilityWarningShown = false;

const getEmailDomain = (email = '') => String(email).split('@')[1]?.toLowerCase() || '';

const warnAboutDeliverabilityConfig = () => {
  if (deliverabilityWarningShown) return;
  deliverabilityWarningShown = true;

  const fromDomain = getEmailDomain(process.env.EMAIL_FROM);
  const replyToDomain = getEmailDomain(getReplyTo());

  if (freeEmailDomains.has(fromDomain)) {
    console.warn(
      `Email deliverability warning: EMAIL_FROM uses ${fromDomain}. ` +
        'SendGrid cannot authenticate free mailbox domains for your app. ' +
        'Use an address on a domain you own, then authenticate that domain in SendGrid with SPF/DKIM and add DMARC.'
    );
  }

  if (replyToDomain && fromDomain && replyToDomain !== fromDomain) {
    console.warn(
      `Email deliverability warning: EMAIL_REPLY_TO domain (${replyToDomain}) does not match EMAIL_FROM domain (${fromDomain}). ` +
        'Use the same authenticated domain when possible.'
    );
  }
};

const buildUnsubscribeHeaders = () => {
  if (!process.env.CLIENT_URL) return {};

  const settingsUrl = `${process.env.CLIENT_URL}/settings`;
  return {
    'List-Unsubscribe': `<${settingsUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
};

const sendEmail = async (to, subject, html, options = {}) => {
  if (!process.env.SENDGRID_API_KEY) {
    throw new Error('SendGrid API key missing');
  }

  if (!process.env.EMAIL_FROM) {
    throw new Error('Email sender address (EMAIL_FROM) is missing');
  }

  warnAboutDeliverabilityConfig();

  try {
    await sgMail.send({
      to,
      from: getSender(),
      ...(getReplyTo() ? { replyTo: getReplyTo() } : {}),
      subject,
      html,
      text: options.text || stripHtml(html),
      categories: options.categories || ['nexus-chat'],
      headers: {
        ...(options.includeUnsubscribe ? buildUnsubscribeHeaders() : {}),
        ...(options.headers || {}),
      },
      trackingSettings: {
        clickTracking: { enable: false, enableText: false },
        openTracking: { enable: false },
        subscriptionTracking: { enable: false },
      },
      mailSettings: {
        bypassListManagement: { enable: false },
      },
    });
  } catch (error) {
    console.error('SendGrid error:', error?.message || error);
    throw error;
  }
};

const hasRealConfigValue = (value) =>
  Boolean(value) &&
  !String(value).includes('your_gmail') &&
  !String(value).includes('your_') &&
  !String(value).includes('example');

const isEmailConfigured = () =>
  Boolean(process.env.SENDGRID_API_KEY) &&
  Boolean(process.env.EMAIL_FROM);
const normalizeId = (value) => (typeof value === 'object' ? value?._id : value)?.toString?.() || '';
const getPublicEmailError = (error) => {
  const message = String(error?.message || '');

  if (
    message.includes('535-5.7.8') ||
    message.toLowerCase().includes('username and password not accepted') ||
    message.toLowerCase().includes('badcredentials')
  ) {
    return 'Email account login failed. Check your SendGrid credentials and DNS settings.';
  }

  return 'Email service could not send the notification. Check backend email configuration.';
};

const getMessagePreview = (message) => {
  if (message.content?.trim()) return message.content.slice(0, 100);
  if (message.messageType === 'image') return '[Image]';
  if (message.messageType === 'video') return '[Video]';
  if (message.messageType === 'audio') return '[Audio]';
  if (message.messageType === 'document') return '[Document]';
  if (message.messageType === 'location') return '[Location]';
  if (message.messageType === 'poll') return `[Poll] ${message.poll?.question || 'New poll'}`;
  if (message.messageType === 'call') return message.content?.trim() || '[Call]';
  return '[Media]';
};

const buildNotificationCopy = (message, notificationType = 'message') => {
  const senderName = message.senderId?.name || 'Someone';
  const preview = getMessagePreview(message);
  const time = new Date(message.createdAt || Date.now()).toLocaleTimeString();

  if (notificationType === 'message_edit') {
    return {
      subject: `Edited message from ${senderName} on Nexus Chat`,
      intro: `A message from <strong>${senderName}</strong> was edited while you were offline:`,
      accent: '#ffb347',
      buttonLabel: 'View Edited Message',
      preview,
      time,
      footer: "You're receiving this because you were offline when the message was edited.",
    };
  }

  if (notificationType === 'friend_request') {
    return {
      subject: `Friend request from ${senderName} on Nexus Chat`,
      intro: `<strong>${senderName}</strong> sent you a friend request with this message:`,
      accent: '#ff6ab0',
      buttonLabel: 'Review Friend Request',
      preview,
      time,
      footer: "You're receiving this because you were offline when the friend request arrived.",
    };
  }

  if (notificationType === 'message_request') {
    return {
      subject: `Message request from ${senderName} on Nexus Chat`,
      intro: `<strong>${senderName}</strong> wants to start chatting with you and sent this intro:`,
      accent: '#7c6aff',
      buttonLabel: 'Review Message Request',
      preview,
      time,
      footer: "You're receiving this because you were offline when the message request arrived.",
    };
  }

  return {
    subject: `New message from ${senderName} on Nexus Chat`,
    intro: `You have a new message from <strong>${senderName}</strong>:`,
    accent: '#6c63ff',
    buttonLabel: 'Open Chat',
    preview,
    time,
    footer: "You're receiving this because you're offline.",
  };
};

exports.sendEmailNotification = async (recipient, message, options = {}) => {
  try {
    if (!isEmailConfigured()) {
      console.warn('Email notification skipped. SendGrid not configured:', {
        SENDGRID_API_KEY: !!process.env.SENDGRID_API_KEY,
        EMAIL_FROM: process.env.EMAIL_FROM || 'NOT SET',
      });
      return;
    }

    const { notificationType = 'message' } = options;
    const { subject, intro, accent, buttonLabel, preview, time, footer } = buildNotificationCopy(
      message,
      notificationType
    );
    const chatUrl = `${process.env.CLIENT_URL}/chat/${normalizeId(message.chatId)}`;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f4f4f4;padding:20px;border-radius:12px">
        <div style="background:${accent};color:white;padding:20px;border-radius:8px;text-align:center">
          <h1 style="margin:0;font-size:24px">Nexus Chat</h1>
        </div>
        <div style="background:white;padding:20px;margin-top:16px;border-radius:8px">
          <p style="color:#333;font-size:16px">Hey <strong>${recipient.name}</strong>,</p>
          <p style="color:#555">${intro}</p>
          <div style="background:#f0f0ff;border-left:4px solid ${accent};padding:12px;border-radius:4px;margin:16px 0">
            <p style="margin:0;color:#333;font-size:14px">${preview}</p>
            <p style="margin:8px 0 0;color:#999;font-size:12px">${time}</p>
          </div>
          <a href="${chatUrl}"
             style="display:inline-block;background:${accent};color:white;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold">
            ${buttonLabel}
          </a>
        </div>
        <p style="text-align:center;color:#999;font-size:12px;margin-top:16px">
          ${footer}
          <a href="${process.env.CLIENT_URL}/settings">Manage notifications</a>
        </p>
      </div>
    `;

    await sendEmail(recipient.email, subject, html, {
      categories: ['nexus-chat-notification'],
      includeUnsubscribe: true,
    });
    console.log(`Email sent to ${recipient.email}`);
  } catch (error) {
    console.error('Email error:', getPublicEmailError(error), error);
  }
};

exports.sendPasswordResetEmail = async (user, resetUrl) => {
  if (!isEmailConfigured()) {
    throw new Error('Email service is not configured.');
  }

  const subject = 'Reset your Nexus Chat password';
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f4f4f8;padding:20px;border-radius:12px">
      <div style="background:linear-gradient(135deg,#6c63ff,#ff6ab0);color:white;padding:24px;border-radius:10px;text-align:center">
        <h1 style="margin:0;font-size:26px">Nexus Chat</h1>
        <p style="margin:10px 0 0;font-size:14px;opacity:0.9">Password Reset Request</p>
      </div>
      <div style="background:white;padding:24px;margin-top:16px;border-radius:10px">
        <p style="color:#333;font-size:16px">Hey <strong>${user.name}</strong>,</p>
        <p style="color:#555;line-height:1.7">
          We received a request to reset your password. Use the button below to choose a new one.
          This link will expire in <strong>1 hour</strong>.
        </p>
        <div style="margin:24px 0;text-align:center">
          <a href="${resetUrl}"
             style="display:inline-block;background:linear-gradient(135deg,#6c63ff,#ff6ab0);color:white;padding:14px 24px;text-decoration:none;border-radius:10px;font-weight:bold">
            Reset Password
          </a>
        </div>
        <p style="color:#777;font-size:13px;line-height:1.7">
          If the button does not work, copy and paste this URL into your browser:
        </p>
        <p style="word-break:break-all;color:#6c63ff;font-size:13px">${resetUrl}</p>
        <p style="color:#777;font-size:13px;line-height:1.7;margin-top:20px">
          If you did not request this, you can safely ignore this email.
        </p>
      </div>
    </div>
  `;

  try {
    await sendEmail(user.email, subject, html, {
      categories: ['nexus-chat-password-reset'],
    });
  } catch (error) {
    console.error('SendGrid error:', error?.message || error);
    throw error;
  }
};

exports.sendGroupInviteEmail = async ({ invitee, inviter, group }) => {
  try {
    if (!isEmailConfigured()) {
      console.warn('Group invite email skipped. SendGrid not configured:', {
        SENDGRID_API_KEY: !!process.env.SENDGRID_API_KEY,
        EMAIL_FROM: process.env.EMAIL_FROM || 'NOT SET',
      });
      return { sent: false, reason: 'Email is not configured' };
    }

    if (invitee?.notificationPreferences?.emailNotifications === false) {
      console.warn(`Group invite email skipped: ${invitee.email} has email notifications disabled.`);
      return { sent: false, reason: 'Recipient has email notifications disabled' };
    }

    const groupName = group?.chatName || 'a group';
    const inviterName = inviter?.name || 'Someone';
    const settingsUrl = `${process.env.CLIENT_URL}/settings`;
    const subject = `${inviterName} invited you to ${groupName} on Nexus Chat`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f4f4f8;padding:20px;border-radius:12px">
        <div style="background:linear-gradient(135deg,#7c6aff,#ff6ab0);color:white;padding:22px;border-radius:10px;text-align:center">
          <h1 style="margin:0;font-size:24px">Nexus Chat</h1>
          <p style="margin:8px 0 0;font-size:14px;opacity:.9">Group Invite</p>
        </div>
        <div style="background:white;padding:22px;margin-top:16px;border-radius:10px">
          <p style="color:#333;font-size:16px">Hey <strong>${invitee.name}</strong>,</p>
          <p style="color:#555;line-height:1.7">
            <strong>${inviterName}</strong> invited you to join <strong>${groupName}</strong>.
            You will be added to the group only after you accept the request.
          </p>
          ${group?.groupDescription ? `<p style="color:#777;line-height:1.7">${group.groupDescription}</p>` : ''}
          <div style="margin:24px 0;text-align:center">
            <a href="${settingsUrl}"
               style="display:inline-block;background:#7c6aff;color:white;padding:13px 22px;text-decoration:none;border-radius:10px;font-weight:bold">
              Review Group Request
            </a>
          </div>
          <p style="color:#777;font-size:13px;line-height:1.7">
            Open Nexus Chat, go to Settings → Privacy → Pending group requests, then accept or decline.
          </p>
        </div>
      </div>
    `;

    await sendEmail(invitee.email, subject, html, {
      categories: ['nexus-chat-group-invite'],
      includeUnsubscribe: true,
    });
    console.log(`Group invite email sent to ${invitee.email}`);
    return { sent: true };
  } catch (error) {
    console.error('Group invite email error:', error.message);
    return { sent: false, reason: getPublicEmailError(error) };
  }
};

exports.isEmailConfigured = isEmailConfigured;
