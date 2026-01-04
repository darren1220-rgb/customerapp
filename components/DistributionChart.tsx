
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { CityStat } from '../types';

interface DistributionChartProps {
  data: CityStat[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const DistributionChart: React.FC<DistributionChartProps> = ({ data }) => {
  return (
    <div className="h-[350px] w-full p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
      <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
        縣市分佈統計
      </h3>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis 
            dataKey="city" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#64748b', fontSize: 12 }}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#64748b', fontSize: 12 }}
          />
          <Tooltip 
            cursor={{ fill: '#f8fafc' }}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={40}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default DistributionChart;
