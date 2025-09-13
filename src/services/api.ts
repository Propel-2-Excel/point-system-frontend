// API Service for Propel2Excel Points System
// Based on Django backend at: https://github.com/extraordinary-yh/propel2excel-points-system-backend

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api';

// Import performance profiler (will be enabled when utils are available)
// import { PerformanceProfiler, NetworkAnalyzer } from '../utils/performanceProfiler';

// Types based on Django backend models
export interface User {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: 'student' | 'company' | 'university' | 'admin';
  total_points: number;
  university?: string;
  major?: string;
  graduation_year?: number;
  display_name?: string;
  company?: string;
  discord_id?: string;
  discord_verified: boolean;
  discord_username_unverified?: string;
  discord_verified_at?: string;
  media_consent?: boolean;
  media_consent_date?: string;
  is_suspended: boolean;
  suspension_reason?: string;
  onboarding_completed?: boolean;
  onboarding_completed_date?: string;
  track?: number | null;
  track_info?: Track | null;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: number;
  name: string;
  description: string;
  points_value: number;
  category: string;
  is_active: boolean;
}

export interface PointsLog {
  id: number;
  user: number;
  activity: Activity;
  points_earned: number;
  details: string;
  timestamp: string;
  // New field from enhanced backend
  activity_category?: string;
}

export interface Incentive {
  id: number;
  name: string;
  description: string;
  points_required: number;
  sponsor: string;
  max_redemptions: number;
  current_redemptions: number;
  is_active: boolean;
  // New fields from backend
  category?: string;
  category_display?: string;
  image_url?: string;
  stock_available?: number;
  can_redeem?: boolean;
}

export interface Redemption {
  id: number;
  user?: User;
  // The actual API returns 'reward' not 'incentive'
  reward?: {
    name: string;
    description?: string;
    image_url?: string;
    points_required?: number;
  };
  // Keep incentive for backwards compatibility
  incentive?: Incentive;
  status: 'pending' | 'approved' | 'shipped' | 'delivered' | 'rejected';
  // The actual API returns 'redeemed_at' not 'redemption_date'
  redeemed_at?: string;
  // Keep redemption_date for backwards compatibility
  redemption_date?: string;
  // The actual API returns 'points_spent'
  points_spent?: number;
  admin_notes?: string;
  // New fields from backend
  delivery_details?: any;
  tracking_info?: string;
  estimated_delivery?: string;
  status_display?: string;
  incentive_image_url?: string;
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
  statusCode?: number;
  isNetworkError?: boolean;
}

// Discord Link Types
export interface DiscordLinkCode {
  code: string;
  expires_at: string;
  used_at: string | null;
}

export interface DiscordLinkStatus {
  linked: boolean;
  discord_id?: string;
}

// New types for enhanced backend features
export interface DashboardStats {
  current_period: {
    total_points: number;
    activities_completed: number;
    points_earned: number;
    start_date: string;
    end_date: string;
  };
  previous_period: {
    total_points: number;
    activities_completed: number;
    points_earned: number;
    start_date: string;
    end_date: string;
  };
  trends: {
    total_points: {
      change: number;
      percentage: number;
      direction: 'up' | 'down';
    };
    activities_completed: {
      change: number;
      percentage: number;
      direction: 'up' | 'down';
    };
    points_earned: {
      change: number;
      percentage: number;
      direction: 'up' | 'down';
    };
  };
}

export interface TimelineData {
  timeline: {
    date: string;
    points_earned: number;
    points_redeemed?: number;  // NEW: From Phase 1 backend
    net_points?: number;       // NEW: From Phase 1 backend
    cumulative_points: number;
    activities_count: number;
    redemptions_count?: number; // NEW: From Phase 1 backend
  }[];
  summary: {
    total_days: number;
    total_points_earned: number;
    average_daily_points: number;
    most_active_date: string;
  };
}

// NEW: Unified Activity Feed Types (Phase 1)
export interface ActivityFeedItem {
  id: string;
  type: 'activity' | 'redemption';
  timestamp: string;
  points_change: number;
  description: string;
  category?: string;
  activity_name?: string;
  reward_name?: string;
  details?: {
    activity_category?: string;
    [key: string]: any;
  };
}

export interface ActivityFeed {
  feed: ActivityFeedItem[];
  total_items: number;
  is_lifetime_data: boolean;
  limit_applied: number | null;
  total_activities: number;
  total_redemptions: number;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: number;
  username: string;
  display_name: string;
  total_points: number;
  points_this_period: number;
  avatar_url?: string;
  is_current_user: boolean;
}

export interface LeaderboardData {
  leaderboard: LeaderboardEntry[];
  current_user_rank: LeaderboardEntry;
  total_participants: number;
}

export interface UserPreferences {
  email_notifications: {
    new_activities?: boolean;
    reward_updates?: boolean;
    leaderboard_changes?: boolean;
  };
  privacy_settings: {
    show_in_leaderboard?: boolean;
    display_name_preference?: 'full_name' | 'first_name_only' | 'username';
  };
  display_preferences: any;
  discord_integration?: {
    is_linked: boolean;
    discord_username?: string;
    sync_activities?: boolean;
  };
}

// New types for profile management
export interface PasswordChangeRequest {
  current_password: string;
  new_password: string;
  discord_id?: string;
}

export interface DiscordVerificationStatus {
  discord_linked: boolean;
  discord_id?: string;
  discord_username?: string;
  discord_verified: boolean;
  discord_verified_at?: string;
  verification_required: boolean;
}

export interface Track {
  id: number;
  name: string;
  display_name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TrackUpdateRequest {
  track_id: number | string; // number for track ID, empty string to remove track
}

export interface ProfileUpdateRequest {
  first_name?: string;
  last_name?: string;
  university?: string;
  major?: string;
  graduation_year?: number;
  display_name?: string;
  media_consent?: boolean;
}

class ApiService {
  private token: string | null = null;
  private requestCache: Map<string, Promise<any>> = new Map();

  constructor() {
    // Load token from localStorage on initialization
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('authToken');
    }
  }

  // Set token for NextAuth integration
  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    overrideToken?: string | null
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    // Use override token if provided, otherwise use instance token
    const activeToken = overrideToken !== undefined ? overrideToken : this.token;
    
    // Create a cache key for request deduplication (include method and token)
    const method = options.method || 'GET';
    const cacheKey = `${method}:${endpoint}:${activeToken ? 'auth' : 'noauth'}:${options.body ? JSON.stringify(options.body) : ''}`;
    
    // Check if this exact request is already in progress
    if (this.requestCache.has(cacheKey)) {
      return this.requestCache.get(cacheKey);
    }
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    
    if (activeToken) {
      headers['Authorization'] = `Bearer ${activeToken}`;
    } else {
      console.warn('⚠️  No auth token - request may be unauthorized:', url);
    }

    // Create the actual request promise
    const requestPromise = this.executeRequest<T>(url, endpoint, options, headers);
    
    // Cache the promise (only for GET requests to avoid caching mutations)
    if (method === 'GET') {
      this.requestCache.set(cacheKey, requestPromise);
      
      // Clean up cache after request completes (success or failure)
      requestPromise.finally(() => {
        this.requestCache.delete(cacheKey);
      });
    }
    
    return requestPromise;
  }

  private async executeRequest<T>(
    url: string,
    endpoint: string,
    options: RequestInit,
    headers: Record<string, string>
  ): Promise<ApiResponse<T>> {
    // Performance profiling with unique timer names to avoid conflicts
    const timerId = `API: ${endpoint}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    let timerStarted = false;
    
    try {
      console.time(timerId);
      timerStarted = true;
      
      const response = await fetch(url, {
        ...options,
        headers,
        // Include credentials for CORS compatibility with backend
        credentials: 'include',
        // Ensure no caching at the fetch level
        cache: 'no-store',
      });

      if (timerStarted) {
        console.timeEnd(timerId);
      }
      
      const data = await response.json();
      
      // Reduced logging - only log occasionally
      if (Math.random() < 0.1) { // Only log 10% of requests
        const size = new Blob([JSON.stringify(data)]).size;
        const sizeKB = (size / 1024).toFixed(2);
        // Data received successfully
      }

      if (!response.ok) {
        // Handle authentication-related errors
        if (response.status === 401 || response.status === 403) {
          console.warn(`🚨 ${response.status} Authentication error detected, triggering logout`);
          // Trigger logout event for components to handle
          this.handleUnauthorizedError();
        }
        
        return {
          error: data.error || data.detail || data || `HTTP ${response.status}`,
          statusCode: response.status,
        };
      }

      return { data };
    } catch (error) {
      // Only call console.timeEnd if the timer was actually started
      if (timerStarted) {
        console.timeEnd(timerId);
      }
      // Network error (backend unreachable, connection refused, etc.)
      return {
        error: error instanceof Error ? error.message : 'Network error',
        isNetworkError: true,
      };
    }
  }

  // Handle 401 unauthorized errors by triggering logout
  private handleUnauthorizedError(): void {
    // Clear tokens immediately
    this.logout();
    
    // Dispatch custom event for components to listen to
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('unauthorized-error', {
        detail: { message: 'Your session has expired. Please log in again.' }
      });
      window.dispatchEvent(event);
    }
  }

  // Public method to manually trigger unauthorized error handling (for testing)
  triggerUnauthorizedError(): void {
    this.handleUnauthorizedError();
  }

  // Authentication methods
  async login(credentials: { username: string; password: string }): Promise<ApiResponse<{ user: User; tokens: { access: string; refresh: string } }>> {
    const response = await this.request<{ user: User; tokens: { access: string; refresh: string } }>('/users/login/', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }, null); // Explicitly pass null to ensure no auth token is sent

    if (response.data?.tokens?.access) {
      this.token = response.data.tokens.access;
      localStorage.setItem('authToken', this.token);
      localStorage.setItem('refreshToken', response.data.tokens.refresh);
      // JWT Tokens stored successfully
    }

    return response;
  }

  async register(userData: {
    username: string;
    email: string;
    password: string;
    role: string;
    first_name?: string;
    last_name?: string;
    university?: string;
    major?: string;
    graduation_year?: number;
    company?: string;
    track?: number;
    discord_data?: {
      discord_username: string;
    };
  }): Promise<ApiResponse<{ 
    user: User; 
    tokens: { access: string; refresh: string };
    message?: string;
    discord_verification_required?: boolean;
    discord_username_pending?: string;
  }>> {
    const response = await this.request<{ 
      user: User; 
      tokens: { access: string; refresh: string };
      message?: string;
      discord_verification_required?: boolean;
      discord_username_pending?: string;
    }>('/users/register/', {
      method: 'POST',
      body: JSON.stringify(userData),
    }, null); // Explicitly pass null to ensure no auth token is sent

    if (response.data?.tokens?.access) {
      this.token = response.data.tokens.access;
      localStorage.setItem('authToken', this.token);
      localStorage.setItem('refreshToken', response.data.tokens.refresh);
      // JWT Tokens stored successfully after registration
    }

    return response;
  }

  async getProfile(token?: string): Promise<ApiResponse<User>> {
    return this.request<User>('/users/profile/', {}, token);
  }

  async updateProfile(profileData: ProfileUpdateRequest, token?: string): Promise<ApiResponse<User>> {
    return this.request<User>('/users/profile/', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    }, token);
  }

  async changePassword(passwordData: PasswordChangeRequest, token?: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.request<{ success: boolean; message: string }>('/users/change-password/', {
      method: 'POST',
      body: JSON.stringify(passwordData),
    }, token);
  }

  async getDiscordVerificationStatus(token?: string): Promise<ApiResponse<DiscordVerificationStatus>> {
    return this.request<DiscordVerificationStatus>('/users/discord_verification/', {}, token);
  }

  logout(): void {
    this.token = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
  }

  // Clear invalid tokens (useful for debugging auth issues)
  clearInvalidTokens(): void {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
      // Cleared potentially invalid tokens
    }
  }

  isAuthenticated(): boolean {
    // Always check localStorage for the latest token
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('authToken');
    }
    return !!this.token;
  }

  // Method to refresh token from localStorage
  refreshToken(): void {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('authToken');
    }
  }

  // Check if current token is still valid
  async validateToken(token?: string): Promise<boolean> {
    try {
      const response = await this.request<{ valid: boolean }>('/users/profile/', {}, token);
      return response.data !== undefined && !response.error;
    } catch (error) {
      // Token validation failed
      return false;
    }
  }

  // Points and Activities
  async getActivities(token?: string): Promise<ApiResponse<Activity[]>> {
    return this.request<Activity[]>('/activities/', {}, token);
  }

  async getPointsHistory(token?: string): Promise<ApiResponse<PointsLog[]>> {
    return this.request<PointsLog[]>('/points-logs/', {}, token);
  }

  async addPoints(userId: number, activityId: number, details?: string, token?: string): Promise<ApiResponse<PointsLog>> {
    return this.request<PointsLog>(`/users/${userId}/add_points/`, {
      method: 'POST',
      body: JSON.stringify({ activity_id: activityId, details }),
    }, token);
  }

  // Incentives and Redemptions
  async getIncentives(token?: string): Promise<ApiResponse<Incentive[]>> {
    return this.request<Incentive[]>('/incentives/', {}, token);
  }

  async redeemIncentive(incentiveId: number, token?: string): Promise<ApiResponse<Redemption>> {
    return this.request<Redemption>('/redemptions/redeem/', {
      method: 'POST',
      body: JSON.stringify({ incentive_id: incentiveId }),
    }, token);
  }

  async getRedemptions(token?: string): Promise<ApiResponse<Redemption[]>> {
    return this.request<Redemption[]>('/redemptions/', {}, token);
  }

  // Admin methods
  async approveRedemption(redemptionId: number, notes?: string, token?: string): Promise<ApiResponse<Redemption>> {
    return this.request<Redemption>(`/redemptions/${redemptionId}/approve/`, {
      method: 'POST',
      body: JSON.stringify({ admin_notes: notes }),
    }, token);
  }

  async rejectRedemption(redemptionId: number, notes?: string, token?: string): Promise<ApiResponse<Redemption>> {
    return this.request<Redemption>(`/redemptions/${redemptionId}/reject/`, {
      method: 'POST',
      body: JSON.stringify({ admin_notes: notes }),
    }, token);
  }

  // Discord Integration
  async validateDiscordUser(discordUsername: string): Promise<ApiResponse<{
    valid: boolean;
    message: string;
    discord_username: string;
    discord_id: string | null;
    display_name?: string;
    username?: string;
  }>> {
    return this.request('/validate-discord-user/', {
      method: 'POST',
      body: JSON.stringify({ discord_username: discordUsername.trim() }),
    }, null); // No auth required for validation
  }

  async startDiscordLink(token?: string): Promise<ApiResponse<DiscordLinkCode>> {
    return this.request<DiscordLinkCode>('/link/start', {
      method: 'POST',
    }, token);
  }

  async checkDiscordLinkStatus(token?: string): Promise<ApiResponse<DiscordLinkStatus>> {
    return this.request<DiscordLinkStatus>('/link/status', {}, token);
  }

  // Onboarding tracking methods
  async updateConsentStatus(consented: boolean, token?: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.request<{ success: boolean }>('/users/consent/', {
      method: 'POST',
      body: JSON.stringify({ media_consent: consented }),
    }, token);
  }

  async trackLinkedInFollow(platform: 'company' | 'founder', token?: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.request<{ success: boolean }>('/users/linkedin-follow/', {
      method: 'POST',
      body: JSON.stringify({ platform }),
    }, token);
  }

  async completeOnboarding(token?: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.request<{ success: boolean }>('/users/complete_onboarding/', {
      method: 'POST',
    }, token);
  }

  // NEW BACKEND ENDPOINTS
  
  // Dashboard Statistics with Trends
  async getDashboardStats(period: '7days' | '30days' | '90days' = '30days', token?: string): Promise<ApiResponse<DashboardStats>> {
    return this.request<DashboardStats>(`/dashboard/stats/?period=${period}`, {}, token);
  }

  // Points Timeline Chart
  async getPointsTimeline(
    granularity: 'daily' | 'weekly' | 'monthly' = 'daily',
    days: number = 30,
    token?: string
  ): Promise<ApiResponse<TimelineData>> {
    return this.request<TimelineData>(`/points/timeline/?granularity=${granularity}&days=${days}`, {}, token);
  }

  // Leaderboard System
  async getLeaderboard(
    limit: number = 10,
    period: 'all_time' | 'monthly' | 'weekly' = 'all_time',
    token?: string
  ): Promise<ApiResponse<LeaderboardData>> {
    return this.request<LeaderboardData>(`/leaderboard/?limit=${limit}&period=${period}`, {}, token);
  }

  // Enhanced Rewards System
  async getAvailableRewards(token?: string): Promise<ApiResponse<Incentive[]>> {
    return this.request<Incentive[]>('/rewards/available/', {}, token);
  }

  async redeemReward(rewardId: number, deliveryDetails?: any, token?: string): Promise<ApiResponse<Redemption>> {
    return this.request<Redemption>('/rewards/redeem/', {
      method: 'POST',
      body: JSON.stringify({ 
        reward_id: rewardId,
        delivery_details: deliveryDetails 
      }),
    }, token);
  }

  async getRedemptionHistory(token?: string): Promise<ApiResponse<Redemption[]>> {
    return this.request<Redemption[]>('/redemptions/history/', {}, token);
  }

  // User Preferences Management
  async getUserPreferences(token?: string): Promise<ApiResponse<UserPreferences>> {
    return this.request<UserPreferences>('/user-preferences/', {}, token);
  }

  async updateUserPreferences(preferences: Partial<UserPreferences>, token?: string): Promise<ApiResponse<UserPreferences>> {
    return this.request<UserPreferences>('/user-preferences/', {
      method: 'PUT',
      body: JSON.stringify(preferences),
    }, token);
  }

  async getActivityPreferences(token?: string): Promise<ApiResponse<UserPreferences>> {
    return this.request<UserPreferences>('/user-preferences/activity-preferences/', {}, token);
  }

  // NEW: Unified Activity Feed API (Phase 1)
  async getActivityFeed(limitOrToken?: number | string, tokenParam?: string): Promise<ApiResponse<ActivityFeed>> {
    // Handle both function signatures:
    // getActivityFeed(limit, token) - with limit
    // getActivityFeed(token) - without limit (full lifetime)
    
    let limit: number | undefined;
    let token: string | undefined;
    
    if (typeof limitOrToken === 'number') {
      // First parameter is a limit number
      limit = limitOrToken;
      token = tokenParam;
    } else {
      // First parameter is a token string
      limit = undefined;
      token = limitOrToken;
    }
    
    // If limit is provided, send limit parameter; otherwise get full lifetime data
    const url = limit !== undefined && limit !== null 
      ? `/activity/feed/?limit=${limit}` 
      : `/activity/feed/`;
    return this.request<ActivityFeed>(url, {}, token);
  }

  // Future: Lifetime stats summary endpoint (when backend implements it)  
  async getLifetimeStats(token?: string): Promise<ApiResponse<any>> {
    // This would be much faster than loading full history
    return this.request<any>('/dashboard/lifetime-stats/', {}, token);
  }

  // Track System API Methods
  async getTracks(token?: string): Promise<ApiResponse<Track[]>> {
    return this.request<Track[]>('/tracks/', {}, token);
  }

  async updateUserTrack(userId: number, trackData: TrackUpdateRequest, token?: string): Promise<ApiResponse<{ message: string; user: User }>> {
    return this.request<{ message: string; user: User }>(`/users/${userId}/update_track/`, {
      method: 'PATCH',
      body: JSON.stringify(trackData),
    }, token);
  }
}

export const apiService = new ApiService();