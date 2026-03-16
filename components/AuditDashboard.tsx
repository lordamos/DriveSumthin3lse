'use client';

import React, { useState, useEffect } from 'react';
import { SystemAuditService } from '@/lib/audit';
import { db, auth } from '@/lib/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { 
  Activity, 
  ShieldCheck, 
  AlertCircle, 
  TrendingUp, 
  PieChart as PieChartIcon, 
  RefreshCw,
  ArrowUpRight,
  Database,
  History,
  User as UserIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';

interface AuditStats {
  totalPortfolioValue: number;
  totalCollected: number;
  statusCounts: Record<string, number>;
  integrityScore: number;
  integrityErrors: string[];
  totalContracts: number;
  totalVehicles: number;
}

export function AuditDashboard() {
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    setRefreshing(true);
    try {
      const data = await SystemAuditService.getSystemStats();
      if (data) {
        setStats(data as AuditStats);
      }
    } catch (error: any) {
      console.error('Failed to fetch audit stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const runManualAudit = async () => {
    setRefreshing(true);
    try {
      const user = auth.currentUser;
      const result = await SystemAuditService.runFullAudit(user?.email || 'admin');
      alert(`Audit Complete! Integrity Score: ${result.integrityScore}%`);
      await fetchStats();
    } catch (error) {
      console.error('Manual audit failed:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();

    // Listen for reconciliation logs
    const logsQuery = query(
      collection(db, 'reconciliation_logs'), 
      orderBy('timestamp', 'desc'), 
      limit(5)
    );
    
    const unsubscribe = onSnapshot(logsQuery, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setLogs(logsData);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <RefreshCw className="animate-spin text-zinc-500" size={32} />
      </div>
    );
  }

  const pieData = stats ? Object.entries(stats.statusCounts).map(([name, value]) => ({
    name,
    value
  })) : [];

  const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6'];

  return (
    <div className="space-y-8">
      {/* System Pulse */}
      <div className="flex items-center justify-between bg-zinc-900/50 border border-white/5 rounded-3xl p-6">
        <div className="flex items-center gap-4">
          <div className={`w-3 h-3 rounded-full ${stats?.integrityScore === 100 ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]' : 'bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.5)]'} animate-pulse`} />
          <div>
            <h4 className="text-sm font-bold text-white">System Integrity Pulse</h4>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Real-time database reconciliation</p>
          </div>
        </div>
        <button 
          onClick={runManualAudit}
          disabled={refreshing}
          className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-zinc-300 px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'AUDITING...' : 'RUN FULL AUDIT'}
        </button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard 
          title="Integrity Score" 
          value={`${stats?.integrityScore}%`} 
          icon={<ShieldCheck className="text-emerald-500" />}
          trend="+0.0% vs yesterday"
          color="emerald"
        />
        <KpiCard 
          title="Portfolio Value" 
          value={`$${(stats?.totalPortfolioValue || 0).toLocaleString()}`} 
          icon={<TrendingUp className="text-blue-500" />}
          trend="Total Contract Value"
          color="blue"
        />
        <KpiCard 
          title="Total Collected" 
          value={`$${(stats?.totalCollected || 0).toLocaleString()}`} 
          icon={<ArrowUpRight className="text-emerald-500" />}
          trend={`${Math.round(((stats?.totalCollected || 0) / (stats?.totalPortfolioValue || 1)) * 100)}% Recovery Rate`}
          color="emerald"
        />
        <KpiCard 
          title="Active Contracts" 
          value={stats?.totalContracts} 
          icon={<Database className="text-zinc-500" />}
          trend={`${stats?.totalVehicles} Vehicles in Fleet`}
          color="zinc"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-zinc-900/30 border border-white/5 rounded-3xl p-8">
          <h5 className="text-sm font-bold mb-8 flex items-center gap-2">
            <Activity size={16} className="text-emerald-500" />
            Contract Distribution by Status
          </h5>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pieData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="name" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-zinc-900/30 border border-white/5 rounded-3xl p-8">
          <h5 className="text-sm font-bold mb-8 flex items-center gap-2">
            <PieChartIcon size={16} className="text-emerald-500" />
            Portfolio Composition
          </h5>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {pieData.map((entry, index) => (
              <div key={entry.name} className="flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-zinc-400 uppercase tracking-widest">{entry.name}</span>
                </div>
                <span className="font-bold text-white">{entry.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Integrity Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Violations */}
        <div className="bg-zinc-900/30 border border-white/5 rounded-3xl p-8">
          <h5 className="text-sm font-bold mb-6 flex items-center gap-2">
            <AlertCircle size={16} className="text-red-500" />
            Active Integrity Violations
          </h5>
          {stats && stats.integrityErrors.length > 0 ? (
            <div className="space-y-3">
              {stats.integrityErrors.map((error: string, i: number) => (
                <div key={i} className="bg-red-500/5 border border-red-500/10 p-4 rounded-xl font-mono text-[10px] text-red-400">
                  {error}
                </div>
              ))}
            </div>
          ) : (
            <div className="h-40 flex flex-col items-center justify-center text-zinc-500">
              <ShieldCheck size={32} className="mb-2 opacity-20" />
              <p className="text-xs">No active violations detected</p>
            </div>
          )}
        </div>

        {/* Audit History */}
        <div className="bg-zinc-900/30 border border-white/5 rounded-3xl p-8">
          <h5 className="text-sm font-bold mb-6 flex items-center gap-2">
            <History size={16} className="text-blue-500" />
            Reconciliation History
          </h5>
          <div className="space-y-4">
            {logs.map((log) => (
              <div key={log.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${log.integrityScore === 100 ? 'bg-emerald-500/20 text-emerald-500' : 'bg-amber-500/20 text-amber-500'}`}>
                    {log.integrityScore}%
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">Audit Run</span>
                      <span className="text-[10px] text-zinc-500">{log.timestamp?.toDate().toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[9px] text-zinc-500 uppercase tracking-tighter">
                      <UserIcon size={8} />
                      {log.runBy} • {log.totalContracts} Contracts Checked
                    </div>
                  </div>
                </div>
                {log.errors?.length > 0 && (
                  <div className="text-[10px] font-bold text-red-500">
                    {log.errors.length} ERRORS
                  </div>
                )}
              </div>
            ))}
            {logs.length === 0 && (
              <div className="h-40 flex flex-col items-center justify-center text-zinc-500">
                <History size={32} className="mb-2 opacity-20" />
                <p className="text-xs">No audit history available</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ title, value, icon, trend, color }: any) {
  return (
    <div className="bg-zinc-900/30 border border-white/5 rounded-3xl p-6 hover:border-white/10 transition-all">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 bg-white/5 rounded-xl">
          {icon}
        </div>
        <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">{title}</span>
      </div>
      <div className="mb-2">
        <h3 className="text-2xl font-bold text-white">{value}</h3>
      </div>
      <p className="text-[10px] text-zinc-500">{trend}</p>
    </div>
  );
}
