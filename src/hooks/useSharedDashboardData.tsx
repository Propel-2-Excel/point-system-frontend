"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import { apiService, PointsLog, TimelineData, ActivityFeed, ActivityFeedItem } from "../services/api";

// Shared data types
interface DashboardData {
  pointsHistory: PointsLog[] | null;  // Keep for backward compatibility
  activityFeed: ActivityFeed | null;   // NEW: Unified feed (Phase 1)
  timelineData: TimelineData | null;
  dashboardStats: any | null;          // NEW: Dashboard stats data
  availableRewards: any[] | null;      // NEW: Available rewards data
  isLoading: boolean;
  error: string | null;
  lastFetch: number | null;
  userProfile: any | null; // NEW: Add user profile to global cache
}

interface ProcessedData {
  chartData: Array<{
    date: string;
    points: number;
    points_redeemed: number;
    net_points: number;
    redemptions_count: number;
  }>;
  recentActivity: ActivityFeedItem[];
  categoryTotals: Record<string, number>;
  categoryData: CategoryData[]; // Add this for components that need formatted data
  totalPoints: number;
  totalActivities: number;
  totalRedemptions: number;
}

interface CategoryData {
  name: string;
  value: number;
  color: string;
  gradient: string;
}

// Cache duration in milliseconds (no caching needed since backend is fast - 500ms)
const CACHE_DURATION = 0; // No caching - always fetch fresh data

// New complementary color palette with strong contrast
const CATEGORY_COLORS: Record<string, {color: string, gradient: string}> = {
  'engagement': {
    color: '#7C3AED',
    gradient: 'linear-gradient(135deg, #7C3AED 0%, #8B5CF6 100%)'
  },
  'events': {
    color: '#4C1D95',
    gradient: 'linear-gradient(135deg, #4C1D95 0%, #6366F1 100%)'
  },
  'content': {
    color: '#0EA5E9',
    gradient: 'linear-gradient(135deg, #0EA5E9 0%, #67E8F9 100%)'
  },
  'professional': {
    color: '#10B981',
    gradient: 'linear-gradient(135deg, #10B981 0%, #6EE7B7 100%)'
  },
  'social': {
    color: '#3B82F6',
    gradient: 'linear-gradient(135deg, #3B82F6 0%, #60A5FA 100%)'
  },
  'learning': {
    color: '#7C3AED',
    gradient: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)'
  }
};

// New color palette fallback colors
const FALLBACK_COLORS = [
  '#7C3AED', '#4C1D95', '#0EA5E9', '#10B981', '#3B82F6'
];
const FALLBACK_GRADIENTS = [
  'linear-gradient(135deg, #7C3AED 0%, #8B5CF6 100%)',
  'linear-gradient(135deg, #4C1D95 0%, #6366F1 100%)',
  'linear-gradient(135deg, #0EA5E9 0%, #67E8F9 100%)',
  'linear-gradient(135deg, #10B981 0%, #6EE7B7 100%)',
  'linear-gradient(135deg, #3B82F6 0%, #60A5FA 100%)'
];

// Global cache for dashboard data (shared across all components)
let globalCache: DashboardData = {
  pointsHistory: null,     // Keep for backward compatibility
  activityFeed: null,      // NEW: Unified feed (Phase 1)
  timelineData: null,
  dashboardStats: null,    // NEW: Dashboard stats data
  availableRewards: null,  // NEW: Available rewards data
  isLoading: false,
  error: null,
  lastFetch: null,
  userProfile: null // NEW: Initialize user profile
};

// Cache version for invalidation
let cacheVersion = 0;

// Global subscribers to notify components of data changes
let subscribers: Set<() => void> = new Set();

// Global refresh function that can be called from anywhere
let globalRefreshFunction: ((force?: boolean) => Promise<void>) | null = null;

// Global fetch state to prevent multiple simultaneous fetches
let currentFetchPromise: Promise<void> | null = null;
let lastFetchToken: string | null = null;

// Cache for processed data to prevent redundant calculations
let processedDataCache: ProcessedData | null = null;
let processedDataCacheVersion = -1;

// No page load tracking needed - always fetch fresh data

// No throttling needed - we want to see all refresh attempts for debugging

// Export function to trigger dashboard refresh from external components
export const refreshDashboardData = async (force: boolean = false) => {
  if (globalRefreshFunction) {
    console.log('🔄 Executing global refresh function');
    await globalRefreshFunction(force);
  } else {
    console.warn('⚠️ Global refresh function not available');
  }
};

// Debug function to force refresh from browser console
if (typeof window !== 'undefined') {
  (window as any).forceDashboardRefresh = () => {
    // Manual dashboard refresh triggered from console
    return refreshDashboardData(true);
  };
  
  // Add immediate refresh function for testing
  (window as any).refreshNow = async () => {
    // IMMEDIATE REFRESH - clearing all cache and fetching fresh data
    
    // Clear all cache data
    globalCache.lastFetch = null;
    globalCache.dashboardStats = null;
    globalCache.activityFeed = null;
    globalCache.timelineData = null;
    globalCache.availableRewards = null;
    globalCache.pointsHistory = null;
    globalCache.userProfile = null; // Clear user profile
    globalCache.isLoading = false;
    globalCache.error = null;
    
    // Clear processed data cache
    processedDataCache = null;
    processedDataCacheVersion = -1;
    
    // Increment cache version to force invalidation
    cacheVersion++;
    
    // Force all React components to re-render with empty data
    subscribers.forEach(callback => callback());
    
    // Wait a moment for React to update, then fetch fresh data
    setTimeout(async () => {
      if (globalRefreshFunction) {
        await globalRefreshFunction(true);
      }
    }, 100);
    
    return `Cache cleared (version ${cacheVersion}), fetching fresh data...`;
  };
  
  // Add nuclear option - completely reset everything
  (window as any).nuclearRefresh = () => {
    // NUCLEAR REFRESH - completely resetting everything
    
    // Reset global cache object completely
    globalCache = {
      pointsHistory: null,
      activityFeed: null,
      timelineData: null,
      dashboardStats: null,
      availableRewards: null,
      userProfile: null, // Reset user profile
      isLoading: false,
      error: null,
      lastFetch: null
    };
    
    // Clear processed data cache
    processedDataCache = null;
    processedDataCacheVersion = -1;
    
    // Increment cache version
    cacheVersion++;
    
    // Force all components to re-render
    subscribers.forEach(callback => callback());
    
    // Reload the page to ensure fresh start
    window.location.reload();
    
    return 'Nuclear refresh initiated - page will reload';
  };

  // Debug function to compare data freshness
  (window as any).debugPointTracker = () => {
    const timeline = globalCache.timelineData?.timeline;
    const activityFeed = globalCache.activityFeed?.feed;
    const todayStr = new Date().toISOString().split('T')[0];
    
    const todaysActivities = activityFeed?.filter(item => 
      item.timestamp.startsWith(todayStr) && item.type === 'activity'
    ) || [];
    
    return {
      timeline: timeline?.length || 0,
      activityFeed: activityFeed?.length || 0,
      todaysActivities: todaysActivities.length,
      backendTotal: globalCache.userProfile?.total_points || 0
    };
  };

  // 🐛 DEBUG: Helper function to analyze activity feed for negative points
  (window as any).debugActivityFeed = () => {
    const activityFeed = globalCache.activityFeed?.feed;
    if (!activityFeed) {
      return null;
    }
    
    const activities = activityFeed.filter(item => item.type === 'activity');
    const redemptions = activityFeed.filter(item => item.type === 'redemption');
    
    return {
      totalItems: activityFeed.length,
      activities: activities.length,
      redemptions: redemptions.length,
      activityPoints: activities.reduce((sum, item) => sum + item.points_change, 0),
      redemptionPoints: redemptions.reduce((sum, item) => sum + item.points_change, 0), // Should be negative
      netPoints: activities.reduce((sum, item) => sum + item.points_change, 0) + redemptions.reduce((sum, item) => sum + item.points_change, 0)
    };
  };
}

export const useSharedDashboardData = () => {
  const { data: session, status } = useSession();
  const [data, setData] = useState<DashboardData>(globalCache);
  const subscriberRef = useRef<() => void>();

  // Subscribe to global state changes
  useEffect(() => {
    const updateData = () => setData({...globalCache});
    subscriberRef.current = updateData;
    subscribers.add(updateData);

    return () => {
      if (subscriberRef.current) {
        subscribers.delete(subscriberRef.current);
      }
    };
  }, []);

  // Handle page visibility changes (DISABLED to prevent excessive API calls)
  // useEffect(() => {
  //   let mounted = true;
  //   let timeout: NodeJS.Timeout;
  //   let lastFetchTime = 0;
  //   const MIN_FETCH_INTERVAL = 10000; // Minimum 10 seconds between fetches

  //   const handleVisibilityChange = () => {
  //     if (document.visibilityState === 'visible' && session?.djangoAccessToken && mounted) {
  //       const now = Date.now();
  //       if (now - lastFetchTime < MIN_FETCH_INTERVAL) {
  //         // Skip if we fetched recently
  //         return;
  //       }
        
  //       // Debounce visibility changes to prevent spam
  //       clearTimeout(timeout);
  //       timeout = setTimeout(async () => {
  //         if (mounted) {
  //           lastFetchTime = Date.now();
  //           // Page became visible, fetching fresh data
  //           await fetchData(session.djangoAccessToken);
  //         }
  //       }, 1000); // Increased debounce time
  //     }
  //   };

  //   const handleFocus = () => {
  //     if (session?.djangoAccessToken && mounted) {
  //       const now = Date.now();
  //       if (now - lastFetchTime < MIN_FETCH_INTERVAL) {
  //         // Skip if we fetched recently
  //         return;
  //       }
        
  //       // Debounce focus events to prevent spam
  //       clearTimeout(timeout);
  //       timeout = setTimeout(async () => {
  //         if (mounted) {
  //           lastFetchTime = Date.now();
  //           // Window focused, fetching fresh data
  //           await fetchData(session.djangoAccessToken);
  //         }
  //       }, 1000); // Increased debounce time
  //     }
  //   };

  //   // Only add listeners if we have a token
  //   if (session?.djangoAccessToken) {
  //     document.addEventListener('visibilitychange', handleVisibilityChange);
  //     window.addEventListener('focus', handleFocus);
  //   }

  //   return () => {
  //     mounted = false;
  //     clearTimeout(timeout);
  //     document.removeEventListener('visibilitychange', handleVisibilityChange);
  //     window.removeEventListener('focus', handleFocus);
  //   };
  // }, [session?.djangoAccessToken]);

  // Notify all subscribers of state changes
  const notifySubscribers = () => {
    subscribers.forEach(callback => callback());
  };

  // Check if cache is still valid (but not on page load)
  const isCacheValid = (forceCheck: boolean = false) => {
    // Since backend is now fast (500ms), always fetch fresh data
    // No caching needed - this eliminates the 30-second delay issue
    return false;
  };

  // Fetch fresh data - always execute for immediate updates
  const fetchData = async (token: string): Promise<void> => {
    // Check if same fetch is already in progress
    if (currentFetchPromise && lastFetchToken === token) {
      // Fetch already in progress, waiting for completion
      return currentFetchPromise;
    }

    // fetchData called for dashboard data - immediate execution

    // Create new fetch promise
    currentFetchPromise = executeFetch(token);
    lastFetchToken = token;

    try {
      await currentFetchPromise;
    } finally {
      // Clear current fetch promise when done
      if (currentFetchPromise && lastFetchToken === token) {
        currentFetchPromise = null;
        lastFetchToken = null;
      }
    }
  };

  const executeFetch = async (token: string): Promise<void> => {
    // Starting data fetch
    globalCache.isLoading = true;
    globalCache.error = null;
    
    let hasError = false;
    let errorMessage = '';

    try {
      // Fetch all data in parallel for better performance
      const [
        activityFeedResponse,
        timelineResponse,
        dashboardStatsResponse,
        rewardsResponse,
        userProfileResponse // NEW: Fetch user profile for total_points
      ] = await Promise.all([
        apiService.getActivityFeed(token),
        apiService.getPointsTimeline('daily', 30, token),
        apiService.getDashboardStats('30days', token),
        apiService.getAvailableRewards(token),
        apiService.getProfile(token) // NEW: Get user profile
      ]);

      // Handle activity feed response
      if (activityFeedResponse.error) {
        console.warn('Failed to fetch activity feed:', activityFeedResponse.error);
        hasError = true;
        errorMessage = activityFeedResponse.error;
      } else if (activityFeedResponse.data) {
        globalCache.activityFeed = activityFeedResponse.data;
        
        // 🐛 DEBUG: Compare activity feed with timeline data
        const latestActivity = activityFeedResponse.data.feed[0]; // Most recent first
        const todayStr = new Date().toISOString().split('T')[0];
        const todaysActivities = activityFeedResponse.data.feed.filter(item => 
          item.timestamp.startsWith(todayStr) && item.type === 'activity'
        );
        
        // Activity feed loaded successfully
      }

      // Handle timeline response
      if (timelineResponse.error) {
        console.warn('Failed to fetch timeline:', timelineResponse.error);
        hasError = true;
        errorMessage = timelineResponse.error;
      } else if (timelineResponse.data) {
        globalCache.timelineData = timelineResponse.data;
        
        // 🐛 DEBUG: Detailed timeline logging
        const timeline = timelineResponse.data.timeline;
        const latestEntry = timeline[timeline.length - 1];
        const secondLatest = timeline[timeline.length - 2];
        
        // Timeline data loaded successfully
      }

      // Handle dashboard stats response
      if (dashboardStatsResponse.error) {
        console.warn('Failed to fetch dashboard stats:', dashboardStatsResponse.error);
      } else if (dashboardStatsResponse.data) {
        globalCache.dashboardStats = dashboardStatsResponse.data;
        // Dashboard stats loaded successfully
      }

      // Handle rewards response  
      if (rewardsResponse.error) {
        console.warn('Failed to fetch available rewards:', rewardsResponse.error);
      } else if (rewardsResponse.data) {
        globalCache.availableRewards = Array.isArray(rewardsResponse.data) 
          ? rewardsResponse.data 
          : (rewardsResponse.data as any).rewards || [];
        // Available rewards loaded successfully
      }

      // NEW: Handle user profile response for total_points
      if (userProfileResponse.error) {
        console.warn('Failed to fetch user profile:', userProfileResponse.error);
      } else if (userProfileResponse.data) {
        // Store user profile data for total_points
        globalCache.userProfile = userProfileResponse.data;
        // User profile loaded successfully
      }

      globalCache.error = hasError ? errorMessage : null;
      globalCache.lastFetch = Date.now();

    } catch (error) {
      globalCache.error = error instanceof Error ? error.message : 'Unknown error';
      // Dashboard data fetch error
    } finally {
      globalCache.isLoading = false;
      
      // Force processed cache invalidation when new data arrives
      processedDataCache = null;
      processedDataCacheVersion = -1;
      
      notifySubscribers();
    }
  };

  // Main fetch effect - optimized to prevent React Strict Mode double execution
  useEffect(() => {
    let mounted = true;
    let lastFetchTime = 0;
    const MIN_FETCH_INTERVAL = 5000; // Minimum 5 seconds between fetches

    const loadData = async () => {
      if (status === "authenticated" && session?.djangoAccessToken && mounted) {
        const now = Date.now();
        if (now - lastFetchTime < MIN_FETCH_INTERVAL) {
          // Skip if we fetched recently
          return;
        }
        lastFetchTime = now;
        await fetchData(session.djangoAccessToken);
      }
    };

    // Small delay to let React Strict Mode settle
    const timeoutId = setTimeout(() => {
      if (mounted) {
        loadData();
      }
    }, 100); // Increased delay

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, [session?.djangoAccessToken, status]);

  // Process data for specific components (cached to prevent redundant calculations)
  const getProcessedData = (): ProcessedData => {
    // Check if we can use cached processed data
    if (processedDataCache && processedDataCacheVersion === cacheVersion) {
      return processedDataCache;
    }

    if (!globalCache.activityFeed?.feed || globalCache.activityFeed.feed.length === 0) {
      const emptyData = {
        chartData: globalCache.timelineData?.timeline?.map(item => ({
          date: item.date,
          points: item.points_earned,
          points_redeemed: item.points_redeemed || 0,
          net_points: item.net_points || item.points_earned,
          redemptions_count: item.redemptions_count || 0
        })) || [],
        recentActivity: [],
        categoryTotals: {},
        categoryData: [],
        totalPoints: globalCache.dashboardStats?.current_period?.total_points || 0,
        totalActivities: globalCache.dashboardStats?.current_period?.activities_completed || 0,
        totalRedemptions: 0
      };
      processedDataCache = emptyData;
      processedDataCacheVersion = cacheVersion;
      return emptyData;
    }

    // Process chart data from timeline (if available)
    const chartData = globalCache.timelineData?.timeline?.map(item => ({
      date: item.date,
      points: item.points_earned,
      points_redeemed: item.points_redeemed || 0,
      net_points: item.net_points || item.points_earned,
      redemptions_count: item.redemptions_count || 0
    })) || [];

      // Helper function to infer category from activity data
  const inferCategory = (item: any): string => {
    // First try to get category from backend data
    if (item.details?.activity_category) return item.details.activity_category;
    if (item.category) return item.category;
    
    // If no category from backend, infer from activity type and description
    const description = (item.activity_name || item.description || '').toLowerCase();
    const type = item.type;
    
    // Infer category based on activity description patterns
    if (description.includes('linkedin') || description.includes('social media')) return 'Social';
    if (description.includes('discord') || description.includes('community')) return 'Engagement';
    if (description.includes('event') || description.includes('workshop')) return 'Events';
    if (description.includes('course') || description.includes('learning')) return 'Learning';
    if (description.includes('professional') || description.includes('career')) return 'Professional';
    if (description.includes('content') || description.includes('blog')) return 'Content';
    
    // For redemptions, categorize as 'Rewards'
    if (type === 'redemption') return 'Rewards';
    
    // Default fallback
    return 'Other';
  };

  // Process recent activity from unified activity feed
  const recentActivity = globalCache.activityFeed.feed
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10)
    .map(item => ({
      id: item.id,
      type: item.type,
      timestamp: item.timestamp,
      points_change: item.points_change,
      description: item.description,
      category: inferCategory(item),
      activity_name: item.activity_name,
      reward_name: item.reward_name
    }));

    // Process category totals from unified activity feed (complete lifetime data)
    const categoryTotals: Record<string, number> = {};
    
    globalCache.activityFeed.feed.forEach((item, index) => {
      if (item.type === 'activity' && item.points_change > 0) {
        // Use the same category inference logic for consistency
        const category = inferCategory(item);
        categoryTotals[category] = (categoryTotals[category] || 0) + item.points_change;
      }
    });

    // Calculate totals from unified data
    // FIXED: Use backend total_points instead of calculating from activity feed
    const totalPoints = globalCache.userProfile?.total_points || 0;
    
    const totalActivities = globalCache.activityFeed.total_activities || 0;
    const totalRedemptions = globalCache.activityFeed.total_redemptions || 0;

    // Convert categoryTotals to CategoryData format for components that need it
    const categoryData: CategoryData[] = Object.entries(categoryTotals)
      .sort(([a], [b]) => a.localeCompare(b)) // Sort by category name
      .map(([category, points], index) => {
        const categoryKey = category.toLowerCase();
        const colorMapping = CATEGORY_COLORS[categoryKey];
        
        // Use predefined color if available, otherwise use fallback
        const color = colorMapping?.color || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
        const gradient = colorMapping?.gradient || FALLBACK_GRADIENTS[index % FALLBACK_GRADIENTS.length];
        
        return {
          name: category.charAt(0).toUpperCase() + category.slice(1),
          value: points,
          color,
          gradient
        };
      });
      
        // Reduced logging - only log occasionally
    if (Math.random() < 0.1) {
      // Backend total_points retrieved
    }

    const processedData = {
      chartData,
      recentActivity,
      categoryTotals,
      categoryData,
      totalPoints,
      totalActivities,
      totalRedemptions
    };

    // Cache the processed data
    processedDataCache = processedData;
    processedDataCacheVersion = cacheVersion;

    return processedData;
  };

  // Force refresh function
  const refresh = async (force: boolean = false) => {
    // refresh called with force
    if (session?.djangoAccessToken) {
      // Clear global cache to ensure truly fresh data
      // Clearing cache and fetching fresh data
      globalCache.lastFetch = null;
      globalCache.activityFeed = null;
      globalCache.timelineData = null;
      globalCache.dashboardStats = null;
      globalCache.availableRewards = null;
      globalCache.userProfile = null; // Clear user profile
      globalCache.pointsHistory = null;
      
      // Increment cache version to force invalidation
      cacheVersion++;
      
      // Clear processed data cache
      processedDataCache = null;
      processedDataCacheVersion = -1;
      
      // Force React to re-render by notifying subscribers immediately
      notifySubscribers();
      
      await fetchData(session.djangoAccessToken);
    }
  };

  // Set the global refresh function
  useEffect(() => {
    globalRefreshFunction = refresh;
    
    return () => {
      // Clean up global reference when component unmounts
      if (globalRefreshFunction === refresh) {
        globalRefreshFunction = null;
      }
    };
  }, [session, status]); // Depend on session and status instead of refresh function

  // Clear cache (useful for logout, etc.)
  const clearCache = () => {
    globalCache = {
      pointsHistory: null,
      activityFeed: null,     // NEW: Clear activity feed
      timelineData: null,
      dashboardStats: null,   // NEW: Clear dashboard stats
      availableRewards: null, // NEW: Clear available rewards
      userProfile: null,      // NEW: Clear user profile
      isLoading: false,
      error: null,
      lastFetch: null
    };
    
    // Clear processed data cache
    processedDataCache = null;
    processedDataCacheVersion = -1;
    
    // Increment cache version to force invalidation
    cacheVersion++;
    // Since we're not caching anymore, this just resets the data
    // Data reset, next load will fetch fresh data
    notifySubscribers();
  };

  const processedData = getProcessedData();

  return {
    // Raw data
    pointsHistory: globalCache.pointsHistory,        // Legacy compatibility
    activityFeed: globalCache.activityFeed,          // NEW: Unified feed
    timelineData: globalCache.timelineData,
    dashboardStats: globalCache.dashboardStats,      // NEW: Dashboard stats
    availableRewards: globalCache.availableRewards,  // NEW: Available rewards
    userProfile: globalCache.userProfile,            // NEW: User profile for total_points
    
    // Processed data (always fresh)
    ...processedData,
    
    // State
    isLoading: globalCache.isLoading,
    error: globalCache.error,
    
    // Actions
    refresh,
    clearCache,
    
    // Cache info (no longer caching since backend is fast)
    isCached: false, // Always false since we're not caching
    lastFetch: globalCache.lastFetch,
    cacheVersion // Add cache version for invalidation detection
  };
};
