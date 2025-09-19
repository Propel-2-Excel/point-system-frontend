'use client';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { apiService } from '../../services/api';

interface LinkedInFollowProps {
  userName?: string;
  onComplete: () => void;
}

export const LinkedInFollow = ({ userName, onComplete }: LinkedInFollowProps) => {
  const [followedP2E, setFollowedP2E] = useState(false);
  const [followedFounder, setFollowedFounder] = useState(false);
  const { data: session } = useSession();

  const handleFollowP2E = async () => {
    window.open('https://www.linkedin.com/company/propel2excel/posts/?feedView=all', '_blank');
    setFollowedP2E(true);
    
    // Track the follow action
    if (session?.djangoAccessToken) {
      try {
        await apiService.trackLinkedInFollow('company', session.djangoAccessToken);
      } catch (error) {
        // Failed to track P2E follow
      }
    }
  };

  const handleFollowFounder = async () => {
    window.open('https://www.linkedin.com/in/sebastienfrancois2021/', '_blank');
    setFollowedFounder(true);
    
    // Track the follow action
    if (session?.djangoAccessToken) {
      try {
        await apiService.trackLinkedInFollow('founder', session.djangoAccessToken);
      } catch (error) {
        // Failed to track founder follow
      }
    }
  };

  return (
    <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-6 text-white">
        <div className="flex items-center space-x-3 mb-2">
          <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
          <h2 className="text-2xl font-bold">Stay Connected with P2E</h2>
        </div>
        <p className="text-blue-100">
          Follow us on LinkedIn to stay updated with opportunities, student spotlights, and industry insights
        </p>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          {/* P2E Company Card */}
          <div className="border-2 border-stone-200 rounded-lg p-6 hover:border-blue-300 transition-colors">
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-white border-2 border-stone-200">
                <img 
                  src="/images/p2e-logo.jpg" 
                  alt="Propel2Excel Logo" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback to text if image fails to load
                    const target = e.currentTarget as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = target.nextElementSibling as HTMLDivElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
                <div className="w-full h-full bg-gradient-to-br from-violet-500 to-violet-600 rounded-lg flex items-center justify-center" style={{display: 'none'}}>
                  <span className="text-white font-bold text-xl">P2E</span>
                </div>
              </div>
              <div>
                <h3 className="font-bold text-stone-900">Propel2Excel</h3>
                <p className="text-sm text-stone-600">Company</p>
                <div className="flex items-center space-x-1 mt-1">
                  <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                  <span className="text-xs text-stone-500">LinkedIn</span>
                </div>
              </div>
            </div>
            
            <p className="text-sm text-stone-600 mb-4">
              Get the latest updates on student success stories, new programs, and partnership opportunities.
            </p>
            
            <button
              onClick={handleFollowP2E}
              className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                followedP2E 
                  ? 'bg-green-100 text-green-700 border border-green-200' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {followedP2E ? (
                <div className="flex items-center justify-center space-x-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Followed!</span>
                </div>
              ) : (
                'Follow P2E'
              )}
            </button>
          </div>

          {/* Founder Card */}
          <div className="border-2 border-stone-200 rounded-lg p-6 hover:border-blue-300 transition-colors">
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-white border-2 border-stone-200">
                <img 
                  src="/images/ceo-profile.jpg" 
                  alt="Sebastien François - P2E CEO" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback to text if image fails to load
                    const target = e.currentTarget as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = target.nextElementSibling as HTMLDivElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
                <div className="w-full h-full bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center" style={{display: 'none'}}>
                  <span className="text-white font-bold text-lg">SF</span>
                </div>
              </div>
              <div>
                <h3 className="font-bold text-stone-900">Sebastien François</h3>
                <p className="text-sm text-stone-600">Founder & CEO</p>
                <div className="flex items-center space-x-1 mt-1">
                  <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                  <span className="text-xs text-stone-500">LinkedIn</span>
                </div>
              </div>
            </div>
            
            <p className="text-sm text-stone-600 mb-4">
              Follow for leadership insights, industry trends, and behind-the-scenes content from P2E's founder.
            </p>
            
            <button
              onClick={handleFollowFounder}
              className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                followedFounder 
                  ? 'bg-green-100 text-green-700 border border-green-200' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {followedFounder ? (
                <div className="flex items-center justify-center space-x-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Followed!</span>
                </div>
              ) : (
                'Follow Sebastien'
              )}
            </button>
          </div>
        </div>

        {/* Benefits section */}
        <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <h4 className="font-semibold text-blue-900 mb-2">Why follow us?</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li className="flex items-center space-x-2">
              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
              <span>Early access to new programs and opportunities</span>
            </li>
            <li className="flex items-center space-x-2">
              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
              <span>Student success stories and career inspiration</span>
            </li>
            <li className="flex items-center space-x-2">
              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
              <span>Industry insights and networking tips</span>
            </li>
          </ul>
        </div>

        {/* Progress indicator */}
        <div className="bg-stone-50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-stone-900">Follow Progress</h4>
            <span className="text-sm text-stone-600">
              {followedP2E && followedFounder ? '2/2 Complete' : `${(followedP2E ? 1 : 0) + (followedFounder ? 1 : 0)}/2 Complete`}
            </span>
          </div>
          <div className="w-full bg-stone-200 rounded-full h-2">
            <div 
              className="bg-violet-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((followedP2E ? 1 : 0) + (followedFounder ? 1 : 0)) * 50}%` }}
            ></div>
          </div>
          {!(followedP2E && followedFounder) && (
            <p className="text-sm text-stone-600 mt-2">
              Please follow both P2E and Sebastien on LinkedIn to continue
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={async () => {
              // Mark onboarding as complete
              if (session?.djangoAccessToken) {
                try {
                  await apiService.completeOnboarding(session.djangoAccessToken);
                } catch (error) {
                  // Failed to mark onboarding as complete
                }
              }
              onComplete();
            }}
            disabled={!followedP2E || !followedFounder}
            className={`flex-1 font-medium py-3 px-6 rounded-lg transition-colors ${
              followedP2E && followedFounder
                ? 'bg-violet-600 hover:bg-violet-700 text-white cursor-pointer'
                : 'bg-stone-300 text-stone-500 cursor-not-allowed'
            }`}
          >
            {followedP2E && followedFounder ? 'Continue to Dashboard' : 'Complete LinkedIn Follows to Continue'}
          </button>
        </div>


      </div>
    </div>
  );
};
