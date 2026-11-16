'use client';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { Card, CardHeader, EmptyState } from './ui';
import { BarChart3 } from 'lucide-react';

const COLORS = ['#0F9488', '#1E3B66', '#5F84B9', '#F59E0B', '#8B5CF6', '#E11D48', '#2FB1A4', '#64748B', '#38BDF8', '#A3E635'];
const empty = (d) => !d?.length || d.every((x) => !x.value);
const Wrap = ({ title, subtitle, data, children }) => (
  <Card><CardHeader title={title} subtitle={subtitle} />
    <div className="h-64 p-3">{empty(data) ? <EmptyState icon={BarChart3} title="No data yet" /> : <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>}</div>
  </Card>
);

export const BarCard = ({ title, subtitle, data, horizontal }) => (
  <Wrap title={title} subtitle={subtitle} data={data}>
    <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ left: horizontal ? 24 : 0, right: 12 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#DCE6F3" vertical={!horizontal} horizontal={horizontal ? false : true} />
      {horizontal ? <><XAxis type="number" allowDecimals={false} fontSize={12} /><YAxis type="category" dataKey="name" width={130} fontSize={12} /></> : <><XAxis dataKey="name" fontSize={11} interval={0} angle={-20} textAnchor="end" height={60} /><YAxis allowDecimals={false} fontSize={12} /></>}
      <Tooltip cursor={{ fill: '#EEF3FA' }} />
      <Bar dataKey="value" name="Applications" fill="#0F9488" radius={[6, 6, 0, 0]} />
    </BarChart>
  </Wrap>
);
export const DonutCard = ({ title, subtitle, data }) => (
  <Wrap title={title} subtitle={subtitle} data={data}>
    <PieChart>
      <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={84} paddingAngle={2}>{data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie>
      <Tooltip /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
    </PieChart>
  </Wrap>
);
export const LineCard = ({ title, subtitle, data }) => (
  <Wrap title={title} subtitle={subtitle} data={data}>
    <LineChart data={data} margin={{ left: 0, right: 12 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#DCE6F3" /><XAxis dataKey="name" fontSize={12} /><YAxis allowDecimals={false} fontSize={12} /><Tooltip />
      <Line type="monotone" dataKey="value" name="Applications" stroke="#0F9488" strokeWidth={2.5} dot={{ r: 3 }} />
    </LineChart>
  </Wrap>
);

export const TrendCard = ({ title, subtitle, data, a = 'submitted', b = 'resolved', aLabel = 'Submitted', bLabel = 'Resolved' }) => (
  <Wrap title={title} subtitle={subtitle} data={data.map((d) => ({ ...d, value: d[a] }))}>
    <LineChart data={data} margin={{ left: 0, right: 12 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#DCE6F3" /><XAxis dataKey="month" fontSize={12} /><YAxis allowDecimals={false} fontSize={12} /><Tooltip /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
      <Line type="monotone" dataKey={a} name={aLabel} stroke="#2754D1" strokeWidth={2.5} dot={{ r: 3 }} />
      <Line type="monotone" dataKey={b} name={bLabel} stroke="#16A34A" strokeWidth={2.5} dot={{ r: 3 }} />
    </LineChart>
  </Wrap>
);
export const StackedBarCard = ({ title, subtitle, data }) => (
  <Wrap title={title} subtitle={subtitle} data={data.map((d) => ({ ...d, value: d.submitted }))}>
    <BarChart data={data} layout="vertical" margin={{ left: 24, right: 12 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#DCE6F3" horizontal={false} /><XAxis type="number" allowDecimals={false} fontSize={12} /><YAxis type="category" dataKey="name" width={150} fontSize={11} /><Tooltip cursor={{ fill: '#EEF3FA' }} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
      <Bar dataKey="resolved" name="Resolved" stackId="a" fill="#16A34A" /><Bar dataKey="pending" name="Pending" stackId="a" fill="#F59E0B" /><Bar dataKey="rejected" name="Rejected" stackId="a" fill="#E11D48" />
    </BarChart>
  </Wrap>
);
