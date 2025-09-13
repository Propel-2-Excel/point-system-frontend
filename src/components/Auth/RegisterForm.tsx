'use client';
import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { apiService, Track } from '../../services/api';

interface DiscordValidationResult {
  valid: boolean;
  message: string;
  discord_username: string;
  discord_id: string | null;
  display_name?: string;
  username?: string;
}

export const RegisterForm = ({ onSwitchToLogin }: { onSwitchToLogin: () => void }) => {
  // Step management
  const [currentStep, setCurrentStep] = useState<'discord' | 'registration'>('discord');
  
  // Discord validation state
  const [discordUsername, setDiscordUsername] = useState('');
  const [discordValidating, setDiscordValidating] = useState(false);
  const [discordValidationResult, setDiscordValidationResult] = useState<DiscordValidationResult | null>(null);
  const [discordError, setDiscordError] = useState('');

  // Registration form state
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    role: 'student',
    university: '',
    major: '',
    graduation_year: new Date().getFullYear() + 4,
    company: '',
    track: ''
  });
  const [registrationLoading, setRegistrationLoading] = useState(false);
  const [registrationError, setRegistrationError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [passwordValidation, setPasswordValidation] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false
  });

  // Discord verification modal state
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [pendingDiscordUsername, setPendingDiscordUsername] = useState('');

  // Track selection state
  const [availableTracks, setAvailableTracks] = useState<Track[]>([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);

  // Load available tracks on component mount
  useEffect(() => {
    const loadTracks = async () => {
      setIsLoadingTracks(true);
      try {
        const response = await apiService.getTracks();
        if (response.data) {
          setAvailableTracks(response.data);
        }
      } catch (err) {
        console.warn('Failed to load career tracks:', err);
      } finally {
        setIsLoadingTracks(false);
      }
    };

    loadTracks();
  }, []);

  // Step 1: Discord Username Validation
  const validateDiscordUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!discordUsername.trim()) {
      setDiscordError('Please enter your Discord username');
      return;
    }

    setDiscordValidating(true);
    setDiscordError('');

    try {
      const response = await apiService.validateDiscordUser(discordUsername);
      
      if (response.error) {
        setDiscordError('Connection error. Please try again.');
        return;
      }

      if (response.data) {
        // Handle validation errors from backend
        if ('discord_username' in response.data && Array.isArray((response.data as any).discord_username)) {
          setDiscordError((response.data as any).discord_username[0]);
          return;
        }

        // Handle validation result
        if (response.data.valid) {
          setDiscordValidationResult(response.data);
          setCurrentStep('registration');
          setDiscordError('');
        } else {
          setDiscordError(response.data.message);
        }
      }
    } catch (error) {
      setDiscordError('Validation failed. Please try again.');
    } finally {
      setDiscordValidating(false);
    }
  };

  // Step 2: Complete Registration
  const handleRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!discordValidationResult) {
      setRegistrationError('Please validate your Discord account first.');
      return;
    }

    // Validate password before submission
    if (!isPasswordValid(formData.password)) {
      showFieldError('password', 'Password does not meet security requirements');
      setRegistrationError('Please fix the password requirements before continuing.');
      return;
    }

    setRegistrationLoading(true);
    setRegistrationError('');
    clearAllFieldErrors(); // Clear any previous field errors

    try {
      // Prepare registration data with Discord data
      const registrationData = {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        first_name: formData.first_name,
        last_name: formData.last_name,
        role: formData.role,
        university: formData.university,
        major: formData.major,
        graduation_year: formData.graduation_year,
        company: formData.company,
        track: formData.track ? parseInt(formData.track) : undefined,
        discord_data: {
          discord_username: discordValidationResult.username || discordValidationResult.discord_username
        }
      };

      // Remove empty fields but ensure required fields are present
      const cleanData = Object.fromEntries(
        Object.entries(registrationData).filter(([key, value]) => {
          if (key === 'discord_data') return true; // Always include discord_data
          if (['username', 'email', 'password', 'role', 'first_name', 'last_name'].includes(key)) {
            return value !== ''; // Keep required fields if not empty
          }
          return value !== '' && value !== 0;
        })
      ) as typeof registrationData;

      const response = await apiService.register(cleanData);
      
      if (response.data) {
        // Store auth tokens
        if (response.data.tokens?.access) {
          localStorage.setItem('authToken', response.data.tokens.access);
          localStorage.setItem('refreshToken', response.data.tokens.refresh);
        }

        // Clear any previous errors
        clearAllFieldErrors();
        setRegistrationError('');

        // Handle Discord verification requirement
        if (response.data.discord_verification_required && response.data.discord_username_pending) {
          setPendingDiscordUsername(response.data.discord_username_pending);
          setShowVerificationModal(true);
        } else {
          // No verification needed, proceed with login
          const result = await signIn('credentials', {
            username: cleanData.username,
            password: cleanData.password,
            redirect: false,
          });

          if (result?.error) {
            setRegistrationError('Registration successful but automatic login failed. Please try logging in manually.');
          } else {
            localStorage.setItem('freshRegistration', 'true');
          }
        }
      } else {
        handleRegistrationErrors(response.error || 'Registration failed');
      }
    } catch (error) {
      setRegistrationError(error instanceof Error ? error.message : 'Registration failed');
    } finally {
      setRegistrationLoading(false);
    }
  };

  // Helper functions for error handling
  const showFieldError = (fieldName: string, message: string) => {
    setFieldErrors(prev => ({ ...prev, [fieldName]: message }));
  };

  const clearFieldError = (fieldName: string) => {
    setFieldErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });
  };

  const clearAllFieldErrors = () => {
    setFieldErrors({});
  };

  const handleRegistrationErrors = (errorData: any) => {
    clearAllFieldErrors();
    
    // Handle field-specific errors
    if (errorData.username) {
      showFieldError('username', errorData.username[0]);
    }
    if (errorData.email) {
      showFieldError('email', errorData.email[0]);
    }
    if (errorData.password) {
      showFieldError('password', errorData.password[0]);
    }
    if (errorData.first_name) {
      showFieldError('first_name', errorData.first_name[0]);
    }
    if (errorData.last_name) {
      showFieldError('last_name', errorData.last_name[0]);
    }
    if (errorData.university) {
      showFieldError('university', errorData.university[0]);
    }
    if (errorData.major) {
      showFieldError('major', errorData.major[0]);
    }
    if (errorData.graduation_year) {
      showFieldError('graduation_year', errorData.graduation_year[0]);
    }
    if (errorData.company) {
      showFieldError('company', errorData.company[0]);
    }
    
    // Handle general errors or non-field errors
    if (errorData.non_field_errors) {
      setRegistrationError(errorData.non_field_errors[0]);
    } else if (errorData.detail) {
      setRegistrationError(errorData.detail);
    } else if (typeof errorData === 'string') {
      setRegistrationError(errorData);
    }
  };

  const validatePassword = (password: string) => {
    return {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)
    };
  };

  const isPasswordValid = (password: string) => {
    const validation = validatePassword(password);
    return validation.length && validation.uppercase && validation.lowercase && validation.number && validation.special;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Clear field error when user starts typing
    if (fieldErrors[name]) {
      clearFieldError(name);
    }
    
    // Validate password in real-time
    if (name === 'password') {
      setPasswordValidation(validatePassword(value));
    }
    
    setFormData(prev => ({ 
      ...prev, 
      [name]: name === 'graduation_year' ? parseInt(value) || 0 : value 
    }));
  };

  const goToOnboarding = () => {
    setShowVerificationModal(false);
    // Proceed to login and then onboarding since account is already created
    signIn('credentials', {
      username: formData.username,
      password: formData.password,
      redirect: false,
    }).then((result) => {
      if (!result?.error) {
        localStorage.setItem('freshRegistration', 'true');
        // The root page will detect freshRegistration and redirect to onboarding
      }
    });
  };

  // Join Discord Server Prompt
  const JoinServerPrompt = () => (
    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
      <h3 className="text-lg font-semibold text-blue-900 mb-2">Join Our Discord Server</h3>
      <p className="text-blue-700 mb-3">To register, you must first join our Discord server:</p>
      <a
        href="https://discord.gg/your-server-invite" // Replace with actual Discord invite
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
      >
        Join Discord Server
      </a>
      <p className="text-sm text-blue-600 mt-2">After joining, come back and try validation again.</p>
    </div>
  );

  // Welcome Modal for New Users
  const DiscordVerificationModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4 max-h-screen overflow-y-auto">
        <div className="text-center mb-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">🎉 Welcome to Propel2Excel!</h2>
        </div>
        
        <div className="mb-4">
          <p className="text-gray-700 mb-3 text-center">
            <strong>Your account has been created successfully!</strong>
          </p>
          <p className="text-gray-600 text-center">
            We're excited to have you join our community. Let's get you set up with a quick 3-step onboarding process.
          </p>
        </div>

        <div className="mb-4 bg-violet-50 border border-violet-200 p-4 rounded-md">
          <h3 className="font-semibold text-violet-900 mb-2">What's Next?</h3>
          <div className="space-y-2 text-sm text-violet-800">
            <div className="flex items-center">
              <span className="w-6 h-6 bg-violet-600 text-white rounded-full flex items-center justify-center text-xs mr-2">1</span>
              Connect your Discord account
            </div>
            <div className="flex items-center">
              <span className="w-6 h-6 bg-violet-600 text-white rounded-full flex items-center justify-center text-xs mr-2">2</span>
              Review and accept our terms
            </div>
            <div className="flex items-center">
              <span className="w-6 h-6 bg-violet-600 text-white rounded-full flex items-center justify-center text-xs mr-2">3</span>
              Connect with us on LinkedIn
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 p-3 rounded-md mb-4">
          <p className="text-blue-700 text-sm">
            <strong>Note:</strong> Your Discord username <strong>{pendingDiscordUsername}</strong> is saved. 
            We'll verify your ownership during the onboarding process.
          </p>
        </div>

        <div>
          <button
            onClick={goToOnboarding}
            className="w-full bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-md transition-colors font-medium"
          >
            Start 3-Step Setup →
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-lg">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-stone-900">
            Join Propel2Excel
          </h2>
          <p className="mt-2 text-center text-sm text-stone-600">
            {currentStep === 'discord' ? 'Verify your Discord account' : 'Complete your registration'}
          </p>
        </div>

        {/* Step 1: Discord Validation */}
        {currentStep === 'discord' && (
          <form onSubmit={validateDiscordUsername} className="space-y-4">
            <div>
              <label htmlFor="discord_username" className="block text-sm font-medium text-stone-700">
                Discord Username *
              </label>
              <input
                id="discord_username"
                name="discord_username"
                type="text"
                required
                placeholder="e.g., JaneDoe#1234"
                maxLength={50}
                className="mt-1 block w-full px-3 py-2 border border-stone-300 rounded-md shadow-sm focus:outline-none focus:ring-violet-500 focus:border-violet-500"
                value={discordUsername}
                onChange={(e) => setDiscordUsername(e.target.value)}
              />
              <p className="mt-1 text-xs text-stone-500">
                Include your discriminator (e.g., #1234) for faster verification
              </p>
            </div>

            {discordError && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">
                {discordError}
                {discordError.includes('not found') && <JoinServerPrompt />}
              </div>
            )}

            {discordValidationResult && discordValidationResult.valid && (
              <div className="text-green-600 text-sm bg-green-50 p-3 rounded-md">
                ✅ Discord account verified! Welcome {discordValidationResult.display_name || discordValidationResult.discord_username}
              </div>
            )}

            <button
              type="submit"
              disabled={discordValidating}
              className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-violet-600 hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 disabled:opacity-50"
            >
              {discordValidating ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Validating...
                </>
              ) : (
                'Verify Discord Account'
              )}
            </button>
          </form>
        )}

        {/* Step 2: Registration Form */}
        {currentStep === 'registration' && (
          <form onSubmit={handleRegistration} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="first_name" className="block text-sm font-medium text-stone-700">
                  First Name *
                </label>
                <input
                  id="first_name"
                  name="first_name"
                  type="text"
                  required
                  className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-violet-500 focus:border-violet-500 ${
                    fieldErrors.first_name 
                      ? 'border-red-500 bg-red-50' 
                      : 'border-stone-300'
                  }`}
                  value={formData.first_name}
                  onChange={handleChange}
                />
                {fieldErrors.first_name && (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.first_name}</p>
                )}
              </div>
              <div>
                <label htmlFor="last_name" className="block text-sm font-medium text-stone-700">
                  Last Name *
                </label>
                <input
                  id="last_name"
                  name="last_name"
                  type="text"
                  required
                  className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-violet-500 focus:border-violet-500 ${
                    fieldErrors.last_name 
                      ? 'border-red-500 bg-red-50' 
                      : 'border-stone-300'
                  }`}
                  value={formData.last_name}
                  onChange={handleChange}
                />
                {fieldErrors.last_name && (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.last_name}</p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-stone-700">
                Username *
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-violet-500 focus:border-violet-500 ${
                  fieldErrors.username 
                    ? 'border-red-500 bg-red-50' 
                    : 'border-stone-300'
                }`}
                value={formData.username}
                onChange={handleChange}
              />
              {fieldErrors.username && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.username}</p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-stone-700">
                Email *
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-violet-500 focus:border-violet-500 ${
                  fieldErrors.email 
                    ? 'border-red-500 bg-red-50' 
                    : 'border-stone-300'
                }`}
                value={formData.email}
                onChange={handleChange}
              />
              {fieldErrors.email && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-stone-700">
                Password *
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-violet-500 focus:border-violet-500 ${
                  fieldErrors.password 
                    ? 'border-red-500 bg-red-50' 
                    : 'border-stone-300'
                }`}
                value={formData.password}
                onChange={handleChange}
              />
              
              {/* Password Requirements */}
              {formData.password && (
                <div className="mt-2 text-xs space-y-1">
                  <div className={`flex items-center ${passwordValidation.length ? 'text-green-600' : 'text-red-600'}`}>
                    <span className="mr-1">{passwordValidation.length ? '✓' : '✗'}</span>
                    At least 8 characters
                  </div>
                  <div className={`flex items-center ${passwordValidation.uppercase ? 'text-green-600' : 'text-red-600'}`}>
                    <span className="mr-1">{passwordValidation.uppercase ? '✓' : '✗'}</span>
                    One uppercase letter
                  </div>
                  <div className={`flex items-center ${passwordValidation.lowercase ? 'text-green-600' : 'text-red-600'}`}>
                    <span className="mr-1">{passwordValidation.lowercase ? '✓' : '✗'}</span>
                    One lowercase letter
                  </div>
                  <div className={`flex items-center ${passwordValidation.number ? 'text-green-600' : 'text-red-600'}`}>
                    <span className="mr-1">{passwordValidation.number ? '✓' : '✗'}</span>
                    One number
                  </div>
                  <div className={`flex items-center ${passwordValidation.special ? 'text-green-600' : 'text-red-600'}`}>
                    <span className="mr-1">{passwordValidation.special ? '✓' : '✗'}</span>
                    One special character (!@#$%^&*...)
                  </div>
                </div>
              )}
              
              {fieldErrors.password && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.password}</p>
              )}
            </div>

            {/* Role Selection */}
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-stone-700">
                Role *
              </label>
              <select
                id="role"
                name="role"
                required
                className="mt-1 block w-full px-3 py-2 border border-stone-300 rounded-md shadow-sm focus:outline-none focus:ring-violet-500 focus:border-violet-500"
                value={formData.role}
                onChange={handleChange}
              >
                <option value="student">Student</option>
                <option value="company">Company</option>
                <option value="university">University</option>
              </select>
            </div>

            {/* Student-specific fields */}
            {formData.role === 'student' && (
              <>
                <div>
                  <label htmlFor="university" className="block text-sm font-medium text-stone-700">
                    University
                  </label>
                  <input
                    id="university"
                    name="university"
                    type="text"
                    className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-violet-500 focus:border-violet-500 ${
                      fieldErrors.university 
                        ? 'border-red-500 bg-red-50' 
                        : 'border-stone-300'
                    }`}
                    value={formData.university}
                    onChange={handleChange}
                  />
                  {fieldErrors.university && (
                    <p className="mt-1 text-sm text-red-600">{fieldErrors.university}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="major" className="block text-sm font-medium text-stone-700">
                    Major
                  </label>
                  <input
                    id="major"
                    name="major"
                    type="text"
                    className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-violet-500 focus:border-violet-500 ${
                      fieldErrors.major 
                        ? 'border-red-500 bg-red-50' 
                        : 'border-stone-300'
                    }`}
                    value={formData.major}
                    onChange={handleChange}
                  />
                  {fieldErrors.major && (
                    <p className="mt-1 text-sm text-red-600">{fieldErrors.major}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="graduation_year" className="block text-sm font-medium text-stone-700">
                    Expected Graduation Year
                  </label>
                  <input
                    id="graduation_year"
                    name="graduation_year"
                    type="number"
                    min={2023}
                    max={new Date().getFullYear() + 10}
                    className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-violet-500 focus:border-violet-500 ${
                      fieldErrors.graduation_year 
                        ? 'border-red-500 bg-red-50' 
                        : 'border-stone-300'
                    }`}
                    value={formData.graduation_year}
                    onChange={handleChange}
                  />
                  {fieldErrors.graduation_year && (
                    <p className="mt-1 text-sm text-red-600">{fieldErrors.graduation_year}</p>
                  )}
                </div>

                {/* Career Track Selection */}
                <div>
                  <label htmlFor="track" className="block text-sm font-medium text-stone-700">
                    Career Track
                  </label>
                  {isLoadingTracks ? (
                    <div className="mt-1 flex items-center text-stone-500 py-2">
                      <div className="animate-spin -ml-1 mr-2 h-4 w-4 border-2 border-stone-300 border-t-stone-600 rounded-full"></div>
                      Loading career tracks...
                    </div>
                  ) : (
                    <select
                      id="track"
                      name="track"
                      className="mt-1 block w-full px-3 py-2 border border-stone-300 rounded-md shadow-sm focus:outline-none focus:ring-violet-500 focus:border-violet-500"
                      value={formData.track}
                      onChange={handleChange}
                    >
                      <option value="">Select a career track</option>
                      {availableTracks.map((track) => (
                        <option key={track.id} value={track.id}>
                          {track.display_name}
                        </option>
                      ))}
                    </select>
                  )}
                  <p className="mt-1 text-xs text-stone-500">
                    Choose your career focus to get personalized activities and opportunities
                  </p>
                </div>
              </>
            )}

            {/* Company field for company role */}
            {formData.role === 'company' && (
              <div>
                <label htmlFor="company" className="block text-sm font-medium text-stone-700">
                  Company Name
                </label>
                <input
                  id="company"
                  name="company"
                  type="text"
                  className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-violet-500 focus:border-violet-500 ${
                    fieldErrors.company 
                      ? 'border-red-500 bg-red-50' 
                      : 'border-stone-300'
                  }`}
                  value={formData.company}
                  onChange={handleChange}
                />
                {fieldErrors.company && (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.company}</p>
                )}
              </div>
            )}

            {registrationError && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">{registrationError}</div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setCurrentStep('discord');
                  setDiscordValidationResult(null);
                  clearAllFieldErrors();
                  setRegistrationError('');
                }}
                className="flex-1 py-2 px-4 border border-stone-300 text-stone-700 rounded-md hover:bg-stone-50 transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={registrationLoading}
                className="flex-1 py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-violet-600 hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 disabled:opacity-50"
              >
                {registrationLoading ? 'Creating Account...' : 'Create Account'}
              </button>
            </div>
          </form>
        )}

        <div className="text-center">
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="text-violet-600 hover:text-violet-500 text-sm"
          >
            Already have an account? Sign in
          </button>
        </div>
      </div>

      {/* Discord Verification Modal */}
      {showVerificationModal && <DiscordVerificationModal />}
    </div>
  );
};