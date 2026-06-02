import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { formatCallDuration } from '../utils/callUtils';
import { userService } from '../services/userService';

const COLORS = ['#6c63ff', '#43e97b', '#ff6584', '#f7971e', '#38bdf8', '#facc15', '#a78bfa'];
const emptyAnalytics = {
  summary: {
    totalMessages: 0,
    messagesSent: 0,
    messagesReceived: 0,
    activeDays: 0,
    totalChats: 0,
    directChats: 0,
    groupChats: 0,
    aiChats: 0,
  },
  callSummary: {
    totalCalls: 0,
    completedCalls: 0,
    missedCalls: 0,
    declinedCalls: 0,
    directCalls: 0,
    groupCalls: 0,
    voiceCalls: 0,
    videoCalls: 0,
    totalDurationSeconds: 0,
    averageDurationSeconds: 0,
    answeredRate: 0,
  },
  dailyActivity: [],
  dailyCallActivity: [],
  peakHours: [],
  messageTypes: [],
  callOutcomes: [],
  callTypes: [],
  callScopes: [],
};

const formatNumber = (value) => new Intl.NumberFormat('en-US').format(value || 0);

const Analytics = () => {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(emptyAnalytics);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadAnalytics = async () => {
      setLoading(true);

      try {
        const data = await userService.getAnalytics();
        if (!cancelled) {
          setAnalytics(data);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error.response?.data?.message || 'Failed to load analytics');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadAnalytics();

    return () => {
      cancelled = true;
    };
  }, []);

  const totalMessageTypes = analytics.messageTypes.reduce((sum, entry) => sum + entry.value, 0);
  const hasAnyData = analytics.summary.totalMessages > 0;
  const hasCallData = analytics.callSummary.totalCalls > 0;
  const totalCallOutcomes = analytics.callOutcomes.reduce((sum, entry) => sum + entry.value, 0);
  const insightCards = [
    {
      label: 'Active Days',
      value: `${analytics.summary.activeDays}/7`,
      helper: 'Days with chat activity this week',
    },
    {
      label: 'Today\'s Chats',
      value: formatNumber(analytics.summary.totalChats),
      helper: 'Chats with activity today, reset at 12:00 AM IST',
    },
  ];
  const callInsightCards = [
    {
      label: 'Total Calls',
      value: formatNumber(analytics.callSummary.totalCalls),
      helper: 'Call summaries found across your visible chats',
    },
    {
      label: 'Answered Rate',
      value: `${analytics.callSummary.answeredRate || 0}%`,
      helper: 'How many logged calls ended with a connection',
    },
    {
      label: 'Call Time',
      value: formatCallDuration(analytics.callSummary.totalDurationSeconds),
      helper: 'Combined connected time from completed calls',
    },
    {
      label: 'Avg Call',
      value: formatCallDuration(analytics.callSummary.averageDurationSeconds),
      helper: 'Average duration of completed calls',
    },
  ];

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-gray-950 text-white">
      <div className="flex shrink-0 items-center gap-4 border-b border-gray-800 bg-gray-900 px-6 py-3">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white transition">
          Back
        </button>
        <h1 className="text-lg font-bold text-white">Chat Analytics</h1>
      </div>

      <div className="app-scrollbar flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {insightCards.map((stat) => (
            <div key={stat.label} className="bg-gray-900 rounded-xl p-4 border border-gray-800 min-h-[108px]">
              <p className="text-gray-400 text-xs uppercase tracking-[0.18em]">{stat.label}</p>
              <div className="mt-3 text-2xl font-bold leading-tight">
                {loading ? <div className="h-8 w-20 rounded bg-gray-800 animate-pulse" /> : stat.value}
              </div>
              <p className="text-gray-500 text-xs mt-2">{stat.helper}</p>
            </div>
          ))}
        </div>

        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 mb-6 flex flex-wrap gap-3 text-sm text-gray-300">
          <span className="rounded-full border border-gray-800 bg-gray-950 px-3 py-1">
            Direct chats today: {loading ? '...' : analytics.summary.directChats}
          </span>
          <span className="rounded-full border border-gray-800 bg-gray-950 px-3 py-1">
            Groups today: {loading ? '...' : analytics.summary.groupChats}
          </span>
          <span className="rounded-full border border-gray-800 bg-gray-950 px-3 py-1">
            AI chats today: {loading ? '...' : analytics.summary.aiChats}
          </span>
          <span className="text-xs text-gray-500 self-center">
            These counts reset daily at 12:00 AM IST.
          </span>
        </div>

        {!loading && !hasAnyData ? (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8 text-center text-gray-400 mb-6">
            <h2 className="text-white text-xl font-semibold mb-2">No chat activity yet</h2>
            <p className="max-w-xl mx-auto">
              Start a few direct chats or group conversations and this page will begin showing your active days, busy
              times, message type breakdown, and call activity.
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <h3 className="text-sm font-semibold text-gray-400 mb-4">Last 7 Days Activity</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={analytics.dailyActivity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="day" stroke="#555" />
                <YAxis stroke="#555" />
                <Tooltip contentStyle={{ background: '#1e2233', border: '1px solid #333' }} />
                <Bar dataKey="sent" fill="#6c63ff" radius={[6, 6, 0, 0]} name="Sent" />
                <Bar dataKey="received" fill="#43e97b" radius={[6, 6, 0, 0]} name="Received" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <h3 className="text-sm font-semibold text-gray-400 mb-4">When You Usually Send Messages</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={analytics.peakHours}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="hour" stroke="#555" />
                <YAxis stroke="#555" />
                <Tooltip contentStyle={{ background: '#1e2233', border: '1px solid #333' }} />
                <Line type="monotone" dataKey="active" stroke="#43e97b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <h3 className="text-sm font-semibold text-gray-400 mb-4">How You Usually Chat</h3>
          <div className="flex flex-col lg:flex-row lg:items-center gap-6">
            {analytics.messageTypes.length ? (
              <>
                <PieChart width={220} height={220}>
                  <Pie data={analytics.messageTypes} cx={110} cy={110} innerRadius={55} outerRadius={78} dataKey="value">
                    {analytics.messageTypes.map((entry, index) => (
                      <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1e2233', border: '1px solid #333' }} />
                </PieChart>

                <div className="space-y-3">
                  {analytics.messageTypes.map((entry, index) => {
                    const percentage = totalMessageTypes
                      ? Math.round((entry.value / totalMessageTypes) * 100)
                      : 0;

                    return (
                      <div key={entry.name} className="flex items-center gap-3 text-sm">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ background: COLORS[index % COLORS.length] }}
                        />
                        <span className="text-gray-200 min-w-[110px]">{entry.name}</span>
                        <span className="text-gray-500">{formatNumber(entry.value)} msgs</span>
                        <span className="text-gray-400">{percentage}%</span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-700 bg-gray-950/60 p-6 text-gray-400">
                Send a few messages first and this chart will show whether you mostly use text, images, audio, documents,
                and more.
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          {callInsightCards.map((stat) => (
            <div key={stat.label} className="bg-gray-900 rounded-xl p-4 border border-gray-800 min-h-[108px]">
              <p className="text-gray-400 text-xs uppercase tracking-[0.18em]">{stat.label}</p>
              <div className="mt-3 text-2xl font-bold leading-tight">
                {loading ? <div className="h-8 w-20 rounded bg-gray-800 animate-pulse" /> : stat.value}
              </div>
              <p className="text-gray-500 text-xs mt-2">{stat.helper}</p>
            </div>
          ))}
        </div>

        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 mb-6 flex flex-wrap gap-3 text-sm text-gray-300">
          <span className="rounded-full border border-gray-800 bg-gray-950 px-3 py-1">
            Voice calls: {loading ? '...' : analytics.callSummary.voiceCalls}
          </span>
          <span className="rounded-full border border-gray-800 bg-gray-950 px-3 py-1">
            Video calls: {loading ? '...' : analytics.callSummary.videoCalls}
          </span>
          <span className="rounded-full border border-gray-800 bg-gray-950 px-3 py-1">
            Direct calls: {loading ? '...' : analytics.callSummary.directCalls}
          </span>
          <span className="rounded-full border border-gray-800 bg-gray-950 px-3 py-1">
            Group calls: {loading ? '...' : analytics.callSummary.groupCalls}
          </span>
        </div>

        {hasCallData ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                <h3 className="text-sm font-semibold text-gray-400 mb-4">Last 7 Days Call Activity</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={analytics.dailyCallActivity}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="day" stroke="#555" />
                    <YAxis stroke="#555" />
                    <Tooltip contentStyle={{ background: '#1e2233', border: '1px solid #333' }} />
                    <Bar dataKey="completed" fill="#43e97b" radius={[6, 6, 0, 0]} name="Answered" />
                    <Bar dataKey="missed" fill="#ff6584" radius={[6, 6, 0, 0]} name="Missed" />
                    <Bar dataKey="declined" fill="#f7971e" radius={[6, 6, 0, 0]} name="Declined" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                <h3 className="text-sm font-semibold text-gray-400 mb-4">Call Outcomes</h3>
                <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                  {analytics.callOutcomes.length ? (
                    <>
                      <PieChart width={220} height={220}>
                        <Pie data={analytics.callOutcomes} cx={110} cy={110} innerRadius={55} outerRadius={78} dataKey="value">
                          {analytics.callOutcomes.map((entry, index) => (
                            <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: '#1e2233', border: '1px solid #333' }} />
                      </PieChart>

                      <div className="space-y-3">
                        {analytics.callOutcomes.map((entry, index) => {
                          const percentage = totalCallOutcomes
                            ? Math.round((entry.value / totalCallOutcomes) * 100)
                            : 0;

                          return (
                            <div key={entry.name} className="flex items-center gap-3 text-sm">
                              <span
                                className="w-3 h-3 rounded-full"
                                style={{ background: COLORS[index % COLORS.length] }}
                              />
                              <span className="text-gray-200 min-w-[110px]">{entry.name}</span>
                              <span className="text-gray-500">{formatNumber(entry.value)} calls</span>
                              <span className="text-gray-400">{percentage}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="rounded-xl border border-dashed border-gray-700 bg-gray-950/60 p-6 text-gray-400">
                      Once calls are logged in your chats, this chart will show how many were answered, missed, or declined.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                <h3 className="text-sm font-semibold text-gray-400 mb-4">Call Format Mix</h3>
                <div className="space-y-3">
                  {analytics.callTypes.length ? (
                    analytics.callTypes.map((entry, index) => (
                      <div key={entry.name} className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-950/60 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ background: COLORS[(index + 2) % COLORS.length] }}
                          />
                          <span className="text-gray-200">{entry.name}</span>
                        </div>
                        <span className="text-gray-400">{formatNumber(entry.value)} calls</span>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-gray-700 bg-gray-950/60 p-6 text-gray-400">
                      Voice and video usage will appear here after you make a few calls.
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                <h3 className="text-sm font-semibold text-gray-400 mb-4">Call Room Mix</h3>
                <div className="space-y-3">
                  {analytics.callScopes.length ? (
                    analytics.callScopes.map((entry, index) => (
                      <div key={entry.name} className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-950/60 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ background: COLORS[(index + 4) % COLORS.length] }}
                          />
                          <span className="text-gray-200">{entry.name}</span>
                        </div>
                        <span className="text-gray-400">{formatNumber(entry.value)} calls</span>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-gray-700 bg-gray-950/60 p-6 text-gray-400">
                      Direct and group call usage will show here once call summaries exist in your chats.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          !loading ? (
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8 text-center text-gray-400 mt-6">
              <h2 className="text-white text-xl font-semibold mb-2">No call analytics yet</h2>
              <p className="max-w-xl mx-auto">
                Make a few voice or video calls and this section will start showing call duration, answered rate,
                outcome trends, and direct versus group usage.
              </p>
            </div>
          ) : null
        )}
      </div>
    </div>
  );
};

export default Analytics;
