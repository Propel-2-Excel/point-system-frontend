"use client";

import React from "react";
import { FiUser } from "react-icons/fi";
import { useSharedDashboardData } from "../../hooks/useSharedDashboardData";
import { ActivityGraphSkeleton } from "./SkeletonLoaders";
import { TimelineData } from "../../services/api";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Line,
  LineChart,
} from "recharts";

export const ActivityGraph = () => {
  const { timelineData, totalPoints, isLoading, error } = useSharedDashboardData();

  // Show skeleton loader while loading
  if (isLoading) {
    return <ActivityGraphSkeleton />;
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // ✅ Calculate chart data with correct cumulative progression
  const chartData = (() => {
    if (!timelineData?.timeline.length) return [];
    
    const timeline = timelineData.timeline;
    const correctTotalPoints = totalPoints || 0;
    
    // Sort timeline by date to ensure proper progression
    const sortedTimeline = [...timeline].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Calculate proper cumulative progression
    let runningTotal = 0;
    const chartDataWithProgression = sortedTimeline.map((item, index) => {
      // Add daily net points to running total
      const dailyNet = (item.points_earned || 0) - (item.points_redeemed || 0);
      runningTotal += dailyNet;
      
      return {
        name: formatDate(item.date),
        Points: runningTotal, // Use calculated running total
        Daily: item.points_earned || 0,
        Redeemed: item.points_redeemed || 0,
        Net: dailyNet,
        Redemptions: item.redemptions_count || 0
      };
    });
    
    // Adjust final total to match the correct total points from activity feed
    const calculatedFinal = chartDataWithProgression[chartDataWithProgression.length - 1]?.Points || 0;
    const adjustment = correctTotalPoints - calculatedFinal;
    
    // Apply adjustment to all points if needed
    if (Math.abs(adjustment) > 0) {
      chartDataWithProgression.forEach(item => {
        item.Points += adjustment;
      });
      
      console.log('📊 ActivityGraph: Adjusted chart data to match total points:', {
        correctTotalPoints,
        calculatedFinal,
        adjustment,
        finalDisplayTotal: chartDataWithProgression[chartDataWithProgression.length - 1]?.Points
      });
    }
    
    return chartDataWithProgression;
  })();

  return (
    <div className="col-span-6 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-50 via-white to-slate-100 shadow-xl border border-slate-200/50 backdrop-blur-sm flex flex-col">
      {/* Modern header with glassmorphism effect */}
      <div className="p-6 bg-gradient-to-r from-white/80 to-slate-50/80 backdrop-blur-sm border-b border-slate-200/50">
        <h3 className="flex items-center gap-2 font-semibold text-slate-800">
          <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
            <FiUser className="text-white text-sm" />
          </div>
          <span className="bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
            Point Tracker
          </span>
        </h3>
      </div>

      <div className="flex-1 p-6">
        {!timelineData || chartData.length === 0 ? (
          <div className="flex items-center justify-center h-full min-h-[200px] text-center">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-50 to-white border border-slate-200 shadow-inner">
              <div className="text-4xl mb-3 opacity-50">📊</div>
              <p className="font-semibold text-slate-700 mb-2">No Timeline Data</p>
              <p className="text-sm text-slate-500">Complete activities to see your points progress over time</p>
            </div>
          </div>
        ) : (
          <div className="w-full h-full min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{
                  top: 10,
                  right: 10,
                  left: 10,
                  bottom: 10,
                }}
              >
                <CartesianGrid stroke="#e4e4e7" strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  className="text-xs font-medium text-slate-600"
                  tick={{ fontSize: 10 }}
                  height={40}
                  interval="preserveStartEnd"
                  minTickGap={30}
                />
                <YAxis 
                  className="text-xs font-medium text-slate-600" 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fontSize: 10 }}
                  width={40}
                  domain={['dataMin - 10', 'dataMax + 10']}
                  allowDataOverflow={false}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0]?.payload;
                      return (
                        <div className="bg-white/95 backdrop-blur-sm p-3 border border-slate-200 rounded-xl shadow-xl">
                          <p className="text-xs text-slate-600 mb-2 font-medium">{label}</p>
                          <p className="text-violet-600 font-semibold">Total: {data?.Points} points</p>
                          {data?.Daily > 0 && (
                            <p className="text-emerald-600 text-sm font-medium">Earned: +{data.Daily} points</p>
                          )}
                          {data?.Redeemed > 0 && (
                            <p className="text-red-500 text-sm font-medium">Redeemed: -{data.Redeemed} points</p>
                          )}
                          {data?.Net !== data?.Daily && (
                            <p className="text-slate-700 text-sm font-medium">Net: {data?.Net > 0 ? '+' : ''}{data?.Net} points</p>
                          )}
                          {data?.Redemptions > 0 && (
                            <p className="text-xs text-slate-500">🎁 {data.Redemptions} redemption{data.Redemptions > 1 ? 's' : ''}</p>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="Points"
                  stroke="#5b21b6"
                  strokeWidth={3}
                  dot={{ 
                    fill: '#5b21b6', 
                    strokeWidth: 2, 
                    r: 4,
                    stroke: '#ffffff'
                  }}
                  activeDot={{ 
                    r: 6, 
                    fill: '#5b21b6',
                    stroke: '#ffffff',
                    strokeWidth: 2
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};
