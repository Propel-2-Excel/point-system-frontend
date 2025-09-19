'use client';
import { useState, useEffect, useCallback } from 'react';
import { apiService, DiscordLinkCode, DiscordLinkStatus } from '../../services/api';
import { useSession } from 'next-auth/react';

interface DiscordLinkingProps {
  userName?: string;
  onComplete: () => void;
}

export const DiscordLinking = ({ userName, onComplete }: DiscordLinkingProps) => {
  const { data: session, status } = useSession();
  const [linkCode, setLinkCode] = useState<DiscordLinkCode | null>(null);
  const [isLinked, setIsLinked] = useState(false);
  const [discordId, setDiscordId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  // Check if user already has Discord linked on mount
  useEffect(() => {
    const checkInitialLinkStatus = async () => {
      if (session?.user?.discord_id) {
        setIsLinked(true);
        setDiscordId(session.user.discord_id);
      } else if (session?.djangoAccessToken) {
        // Double-check with API in case session is stale
        try {
          const response = await apiService.checkDiscordLinkStatus(session.djangoAccessToken);
          if (response.data?.linked) {
            setIsLinked(true);
            setDiscordId(response.data.discord_id);
          }
        } catch (error) {
          // Error checking initial link status
        }
      }
    };

    checkInitialLinkStatus();
  }, [session]);

  // Memoize the onComplete callback to prevent unnecessary re-renders
  const handleLinkComplete = useCallback(() => {
    onComplete();
  }, [onComplete]);

  // Calculate time remaining for countdown
  useEffect(() => {
    if (!linkCode?.expires_at) return;

    const updateTimeRemaining = () => {
      const expiresAt = new Date(linkCode.expires_at).getTime();
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setTimeRemaining(remaining);

      if (remaining === 0) {
        setLinkCode(null);
        setError('Verification code expired. Please generate a new one.');
      }
    };

    updateTimeRemaining();
    const timer = setInterval(updateTimeRemaining, 1000);

    return () => clearInterval(timer);
  }, [linkCode?.expires_at]);

  // Poll for link status when code is active
  useEffect(() => {
    if (!linkCode || isLinked || !session?.djangoAccessToken) {
      return;
    }

    const checkStatus = async () => {
      try {
        const response = await apiService.checkDiscordLinkStatus(session.djangoAccessToken);
        if (response.data?.linked) {
          setIsLinked(true);
          setDiscordId(response.data.discord_id);
          setLinkCode(null);
        }
      } catch (error) {
        // Error checking link status
      }
    };

    const interval = setInterval(checkStatus, 3000); // Poll every 3 seconds
    setPollInterval(interval);

    return () => {
      clearInterval(interval);
      setPollInterval(null);
    };
  }, [linkCode, isLinked, session?.djangoAccessToken]);

  // Separate effect to handle link completion
  useEffect(() => {
    if (isLinked && discordId) {
      // Clear any existing polling interval
      setPollInterval((prevInterval) => {
        if (prevInterval) {
          clearInterval(prevInterval);
        }
        return null;
      });
      
      // Add a small delay to show success state before proceeding
      const timer = setTimeout(() => {
        handleLinkComplete();
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [isLinked, discordId, handleLinkComplete]);

  const generateCode = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Check if user is authenticated with NextAuth
      if (status !== "authenticated" || !session?.djangoAccessToken) {
        setError('No authentication session found. Please try logging in again.');
        return;
      }
      
      const response = await apiService.startDiscordLink(session.djangoAccessToken);
      if (response.data) {
        setLinkCode(response.data);
      } else {
        // API Error
        setError(response.error || 'Failed to generate verification code');
      }
    } catch (error) {
      // Network Error
      setError(error instanceof Error ? error.message : 'Failed to generate verification code');
    } finally {
      setLoading(false);
    }
  };

  const checkLinkStatusNow = async () => {
    if (!session?.djangoAccessToken) return;
    
    try {
      const response = await apiService.checkDiscordLinkStatus(session.djangoAccessToken);
      if (response.data?.linked) {
        setIsLinked(true);
        setDiscordId(response.data.discord_id);
        setLinkCode(null);
      }
    } catch (error) {
      // Error checking link status
    }
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // If already linked, show success state and auto-proceed
  if (isLinked) {
    return (
      <div className="max-w-lg w-full mx-auto bg-white p-8 rounded-xl shadow-lg">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          
          <h2 className="text-2xl font-bold text-stone-900 mb-2">Discord Linked Successfully!</h2>
          <p className="text-stone-600 mb-4">
            Your Discord account is now connected. You can use bot commands and earn points!
          </p>
          
          <div className="bg-green-50 border border-green-200 p-4 rounded-lg mb-6">
            <p className="text-sm text-green-700">
              <strong>Discord ID:</strong> {discordId}
            </p>
          </div>

          <button
            onClick={handleLinkComplete}
            className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            Continue Setup
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg w-full mx-auto bg-white p-8 rounded-xl shadow-lg">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.210.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.010c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.120.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.210 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.210 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
          </svg>
        </div>
        
        <h2 className="text-2xl font-bold text-stone-900 mb-2">Link Your Discord Account</h2>
        <p className="text-stone-600">
          {userName && `Hi ${userName}! `}Complete your Discord verification to access all bot features and start earning points.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg mb-6">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {!linkCode ? (
        <div className="text-center">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 p-6 rounded-xl mb-6">
            <h3 className="font-bold text-xl text-blue-900 mb-4 text-center">🔗 How Discord Linking Works</h3>
            <ol className="text-base text-blue-800 text-left space-y-3">
              <li className="flex items-start">
                <span className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3 mt-0.5">1</span>
                <span className="font-medium">Click "Generate Code" to get your unique 6-digit verification code</span>
              </li>
              <li className="flex items-start">
                <span className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3 mt-0.5">2</span>
                <div>
                  <span className="font-medium">Go to the </span>
                  <span className="font-bold text-blue-700 bg-blue-100 px-2 py-1 rounded">#link-portal-here</span>
                  <span className="font-medium"> channel in Discord and type the command</span>
                </div>
              </li>
              <li className="flex items-start">
                <span className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3 mt-0.5">3</span>
                <span className="font-medium">Your account will be automatically verified and linked</span>
              </li>
            </ol>
          </div>

          <button
            onClick={generateCode}
            disabled={loading}
            className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating Code...
              </div>
            ) : (
              'Generate Verification Code'
            )}
          </button>
        </div>
      ) : (
        <div className="text-center">
          <div className="bg-violet-50 border border-violet-200 p-6 rounded-lg mb-6">
            <h3 className="font-bold text-xl text-violet-900 mb-2">Your Verification Code</h3>
            <div className="text-4xl font-mono font-bold text-violet-600 mb-3 tracking-wider">
              {linkCode.code}
            </div>
            <p className="text-sm text-violet-700 mb-2">
              Expires in: <span className="font-semibold">{formatTime(timeRemaining)}</span>
            </p>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 p-6 rounded-xl mb-6">
            <h4 className="font-bold text-xl text-gray-900 mb-4 text-center">📋 Instructions</h4>
            <ol className="text-base text-gray-700 text-left space-y-3">
              <li className="flex items-start">
                <span className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3 mt-0.5">1</span>
                <span className="font-medium">Open Discord and go to the <strong>Propel2Excel</strong> server</span>
              </li>
              <li className="flex items-start">
                <span className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3 mt-0.5">2</span>
                <div>
                  <span className="font-medium">Navigate to the </span>
                  <span className="font-bold text-blue-700 bg-blue-100 px-2 py-1 rounded">#link-portal-here</span>
                  <span className="font-medium"> channel under the "Onboarding" category</span>
                </div>
              </li>
              <li className="flex items-start">
                <span className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3 mt-0.5">3</span>
                <div>
                  <span className="font-medium">Type this command exactly as shown:</span>
                  <div className="mt-2 p-3 bg-gray-800 text-green-400 rounded-lg font-mono text-lg font-bold text-center border-2 border-gray-600">
                    !link {linkCode.code}
                  </div>
                </div>
              </li>
              <li className="flex items-start">
                <span className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3 mt-0.5">4</span>
                <span className="font-medium">Wait for confirmation - this page will update automatically</span>
              </li>
            </ol>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center text-gray-500 mb-4">
              <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Waiting for Discord verification...
            </div>
            
            <button
              onClick={checkLinkStatusNow}
              className="text-sm text-violet-600 hover:text-violet-800 underline"
            >
              Already linked? Check status
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
