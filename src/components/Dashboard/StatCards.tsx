import React, { useState, useEffect } from "react";
import { FiTrendingDown, FiTrendingUp } from "react-icons/fi";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { DashboardStats } from "../../services/api";
import { useSharedDashboardData } from "../../hooks/useSharedDashboardData";

// Global refresh function for StatCards
let globalStatCardsRefresh: (() => Promise<void>) | null = null;

// Export function to trigger stat cards refresh from external components
export const refreshStatCards = async () => {
  console.log('🔄 refreshStatCards called');
  if (globalStatCardsRefresh) {
    console.log('🔄 Executing StatCards refresh function');
    await globalStatCardsRefresh();
  } else {
    console.warn('⚠️ StatCards refresh function not available');
  }
};

export const StatCards = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { 
    totalPoints, 
    totalActivities, 
    dashboardStats, 
    availableRewards,
    userProfile,
    isLoading: sharedDataLoading 
  } = useSharedDashboardData();

  // Handle click on Activities Completed card - scroll to recent activity section
  const handleActivitiesClick = () => {
    const recentActivityElement = document.querySelector('[data-section="recent-activity"]');
    if (recentActivityElement) {
      recentActivityElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }
  };

  // Handle click on Available Rewards card - navigate to rewards page
  const handleRewardsClick = () => {
    router.push('/rewards');
  };

  // Handle click on Current Points card - scroll to Point Tracker and Lifetime Earnings Chart
  const handlePointsClick = () => {
    // Try to find the Point Tracker first (ActivityGraph component)
    const pointTrackerElement = document.querySelector('[data-section="point-tracker"]');
    if (pointTrackerElement) {
      pointTrackerElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    } else {
      // Fallback: try to find the Lifetime Earnings Chart (UsageRadar component)
      const lifetimeChartElement = document.querySelector('[data-section="lifetime-chart"]');
      if (lifetimeChartElement) {
        lifetimeChartElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }
    }
  };
  
  // ✅ Data Priority (FIXED - backend total_points is most current and accurate):
  // 1. userProfile.total_points (backend API - most current and accurate)
  // 2. dashboardStats.current_period.total_points (backend API - may be outdated)
  // ❌ NO calculated totalPoints from activity feed - backend total_points is always correct
  //
  // 💡 To ensure data is updated, call refreshDashboardData() from external components
  // or use the global refresh function: window.forceDashboardRefresh()
  const [stats, setStats] = useState({
    totalPoints: 0,
    activitiesCompleted: 0,
    availableRewards: 0,
    nextRewardInfo: null as { pointsNeeded: number; rewardName: string } | null,
    loading: true
  });

  const updateStats = async () => {
    try {
      // ✅ FIXED: Use backend total_points field as primary source (most current and accurate)
      let userPoints = 0;
      
      if (userProfile?.total_points !== undefined) {
        // Use backend total_points field (most current and accurate)
        userPoints = userProfile.total_points;
        // Using backend total_points (current)
      } else if (dashboardStats?.current_period?.total_points !== undefined) {
        // Fallback: dashboard stats (may be outdated)
        userPoints = dashboardStats.current_period.total_points;
        // Using dashboard stats total points (fallback)
      } else {
        userPoints = 0;
        // No point data available
      }

      let activitiesCount = 0;
      
      if (dashboardStats?.current_period?.activities_completed !== undefined) {
        // Use dashboard stats for activities completed
        activitiesCount = dashboardStats.current_period.activities_completed;
        // Using dashboard stats activities completed
      } else {
        // Fallback: calculated total from activity feed
        // This fallback gets updated when refreshDashboardData() is called
        activitiesCount = totalActivities || 0;
        // Using calculated activities from activity feed (fallback)
        console.warn('⚠️ Fallback data used - consider calling refreshDashboardData() to update');
      }

      let availableIncentives = 0;
      let nextRewardInfo = null;

      // Calculate available rewards from shared data
      if (availableRewards && Array.isArray(availableRewards)) {
        availableIncentives = availableRewards.filter(reward => {
          const canAfford = userPoints >= reward.points_required;
          const canRedeem = reward.can_redeem;
          const inStock = reward.stock_available === undefined || reward.stock_available > 0;
          return canAfford && canRedeem && inStock;
        }).length;

        // Find the next locked reward (same logic as rewards page)
        const lockedRewards = availableRewards.filter(r => {
          const isAvailable = r.stock_available === undefined || r.stock_available > 0;
          const isUnaffordable = userPoints < r.points_required;
          return isAvailable && isUnaffordable;
        }).sort((a, b) => a.points_required - b.points_required);

        if (lockedRewards.length > 0) {
          const nextReward = lockedRewards[0];
          const pointsNeeded = nextReward.points_required - userPoints;
          nextRewardInfo = {
            pointsNeeded,
            rewardName: nextReward.name
          };
        }
      }

      setStats({
        totalPoints: userPoints,
        activitiesCompleted: activitiesCount,
        availableRewards: availableIncentives,
        nextRewardInfo,
        loading: sharedDataLoading
      });
      
      // StatCards updated successfully
    } catch (error) {
      // Error updating stats
      setStats({
        totalPoints: userProfile?.total_points || dashboardStats?.current_period?.total_points || 0,
        activitiesCompleted: dashboardStats?.current_period?.activities_completed || totalActivities || 0,
        availableRewards: 0,
        nextRewardInfo: null,
        loading: false
      });
    }
  };

  useEffect(() => {
    if (session?.user) {
      updateStats();
    } else {
      setStats({
        totalPoints: 0,
        activitiesCompleted: 0,
        availableRewards: 0,
        nextRewardInfo: null,
        loading: false
      });
    }
  }, [session, status, userProfile, dashboardStats, availableRewards, sharedDataLoading]); // Use shared data dependencies

  // Force immediate refresh when component first mounts (only if no data exists)
  useEffect(() => {
    if (session?.djangoAccessToken && !userProfile && !dashboardStats) {
      import('../../hooks/useSharedDashboardData').then(({ refreshDashboardData }) => {
        refreshDashboardData(true);
      });
    }
  }, []); // Only run once on mount

  // Set up global refresh function (now just updates from shared data)
  useEffect(() => {
    globalStatCardsRefresh = updateStats;
    
    return () => {
      if (globalStatCardsRefresh === updateStats) {
        globalStatCardsRefresh = null;
      }
    };
  }, [updateStats]);

  if (stats.loading) {
    return (
      <>
        <LoadingCard title="Current Points" />
        <LoadingCard title="Activities Completed" />
        <LoadingCard title="Available Rewards" />
      </>
    );
  }

  return (
    <>
      <Card
        title="Current Points"
        value={stats.totalPoints.toString()}
        period={`Earned last 30 days: ${dashboardStats?.current_period?.points_earned || 0} points`}
        trend={dashboardStats?.trends?.total_points}
        onClick={handlePointsClick}
        clickable={true}
      />
      <Card
        title="Activities Completed"
        value={stats.activitiesCompleted.toString()}
        period="Last 30 Days"
        trend={dashboardStats?.trends?.activities_completed}
        onClick={handleActivitiesClick}
        clickable={true}
      />
      <Card
        title="Available Rewards"
        value={stats.availableRewards.toString()}
        period={stats.nextRewardInfo 
          ? `${stats.nextRewardInfo.pointsNeeded} points to unlock: ${stats.nextRewardInfo.rewardName}`
          : "Ready to Redeem"
        }
        onClick={handleRewardsClick}
        clickable={true}
      />
    </>
  );
};

const LoadingCard = ({ title }: { title: string }) => {
  return (
    <div className="col-span-4 p-6 rounded-2xl bg-gradient-to-br from-slate-50 via-white to-slate-100 shadow-xl border border-slate-200/50 backdrop-blur-sm animate-pulse">
      <div className="flex mb-8 items-start justify-between">
        <div>
          <h3 className="text-slate-500 mb-2 text-sm font-medium">{title}</h3>
          <div className="w-16 h-8 bg-slate-200/50 rounded-lg animate-pulse"></div>
        </div>
        <div className="w-12 h-6 bg-slate-200/50 rounded-full animate-pulse"></div>
      </div>
      <div className="w-20 h-4 bg-slate-200/50 rounded animate-pulse"></div>
    </div>
  );
};

const Card = ({
  title,
  value,
  period,
  trend,
  onClick,
  clickable = false,
}: {
  title: string;
  value: string;
  period: string;
  trend?: {
    change: number;
    percentage: number;
    direction: 'up' | 'down';
  };
  onClick?: () => void;
  clickable?: boolean;
}) => {
  return (
    <div 
      className={`col-span-4 p-6 rounded-2xl bg-gradient-to-br from-slate-50 via-white to-slate-100 shadow-xl border border-slate-200/50 backdrop-blur-sm transition-all duration-300 ${
        clickable 
          ? 'hover:shadow-2xl hover:scale-[1.02] cursor-pointer active:scale-[0.98]' 
          : 'hover:shadow-2xl'
      }`}
      onClick={clickable ? onClick : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      } : undefined}
    >
      <div className="flex mb-4 items-start justify-between">
        <div>
          <h3 className="text-slate-600 mb-3 text-sm font-medium">{title}</h3>
          <p className="text-4xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">{value}</p>
        </div>

        {trend && (
          <div className="relative group">
            <span
              className={`text-xs flex items-center gap-1.5 font-semibold px-3 py-2 rounded-full shadow-sm backdrop-blur-sm transition-all duration-200 cursor-help ${
                trend.direction === "up"
                  ? "bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-700 border border-emerald-200/50"
                  : "bg-gradient-to-r from-red-100 to-rose-100 text-red-700 border border-red-200/50"
              }`}
            >
              {trend.direction === "up" ? <FiTrendingUp className="text-sm" /> : <FiTrendingDown className="text-sm" />} 
              {Math.abs(trend.percentage).toFixed(1)}%
            </span>
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
              vs previous 30 days
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500 font-medium tracking-wide">{period}</p>
    </div>
  );
};
