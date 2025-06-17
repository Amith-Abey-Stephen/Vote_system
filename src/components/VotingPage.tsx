import React, { useState, useEffect } from 'react';
import { CheckCircle, UserCheck, Users, AlertCircle, Shield, Clock, Info, Trophy, Medal } from 'lucide-react';
import { API_URL } from '../config';

interface Candidate {
  id: number;
  name: string;
  position: string;
  gender?: string;
}

interface CandidatesData {
  headBoy: Candidate[];
  headGirl: Candidate[];
  sportsCaptain: Candidate[];
  sportsViceCaptain: Candidate[];
}

interface VotingPageProps {
  settings: { votingEnabled: boolean };
}

interface VoterInfo {
  name: string;
  class: string;
  division: string;
  dateOfBirth: string;
}

const VotingPage: React.FC<VotingPageProps> = ({ settings }) => {
  const [step, setStep] = useState<'verification' | 'voting' | 'success'>('verification');
  const [candidates, setCandidates] = useState<CandidatesData>({ 
    headBoy: [], 
    headGirl: [], 
    sportsCaptain: [], 
    sportsViceCaptain: [] 
  });
  const [voterInfo, setVoterInfo] = useState<VoterInfo>({
    name: '',
    class: '',
    division: '',
    dateOfBirth: ''
  });
  const [selectedHeadBoy, setSelectedHeadBoy] = useState<string>('');
  const [selectedHeadGirl, setSelectedHeadGirl] = useState<string>('');
  const [selectedSportsCaptain, setSelectedSportsCaptain] = useState<string>('');
  const [selectedSportsViceCaptain, setSelectedSportsViceCaptain] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [sessionExpiry, setSessionExpiry] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  useEffect(() => {
    fetchCandidates();
  }, []);

  // Session timer
  useEffect(() => {
    if (sessionExpiry) {
      const timer = setInterval(() => {
        const remaining = Math.max(0, sessionExpiry - Date.now());
        setTimeRemaining(remaining);
        
        if (remaining === 0) {
          handleSessionExpiry();
        }
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [sessionExpiry]);

  const handleSessionExpiry = () => {
    setStep('verification');
    setSessionToken('');
    setSessionExpiry(null);
    setError('Your session has expired. Please verify again.');
    setVoterInfo({ name: '', class: '', division: '', dateOfBirth: '' });
    setSelectedHeadBoy('');
    setSelectedHeadGirl('');
    setSelectedSportsCaptain('');
    setSelectedSportsViceCaptain('');
  };

  const fetchCandidates = async () => {
    try {
      const response = await fetch(`${API_URL}/api/candidates`);
      const data = await response.json();
      setCandidates(data);
    } catch (error) {
      console.error('Error fetching candidates:', error);
      setError('Failed to load candidates');
    }
  };

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Basic client-side validation
    if (!voterInfo.name.trim() || !voterInfo.class.trim() || !voterInfo.division.trim() || !voterInfo.dateOfBirth) {
      setError('All fields are required');
      setLoading(false);
      return;
    }

    // Basic name validation
    const cleanName = voterInfo.name.trim();
    if (cleanName.length < 2 || cleanName.length > 100) {
      setError('Name must be between 2-100 characters');
      setLoading(false);
      return;
    }

    // Check for valid characters in name
    if (!/^[a-zA-Z\s\-'.]+$/.test(cleanName)) {
      setError('Name can only contain letters, spaces, hyphens, apostrophes, and dots');
      setLoading(false);
      return;
    }

    // Basic class validation
    if (voterInfo.class.trim().length > 10) {
      setError('Class field must be under 10 characters');
      setLoading(false);
      return;
    }

    // Basic division validation
    if (voterInfo.division.trim().length > 5) {
      setError('Division field must be under 5 characters');
      setLoading(false);
      return;
    }

    // Validate date of birth
    const dob = new Date(voterInfo.dateOfBirth);
    const now = new Date();
    
    if (isNaN(dob.getTime())) {
      setError('Please enter a valid date of birth');
      setLoading(false);
      return;
    }

    if (dob > now) {
      setError('Date of birth cannot be in the future');
      setLoading(false);
      return;
    }

    const age = (now.getTime() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (age < 3 || age > 30) {
      setError('Age must be between 3-30 years for school students');
      setLoading(false);
      return;
    }

    try {
      console.log('Submitting verification for:', voterInfo);
      
      const response = await fetch(`${API_URL}/api/check-voter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(voterInfo)
      });

      const data = await response.json();
      console.log('Verification response:', data);

      if (data.success) {
        setSessionToken(data.sessionToken);
        setSessionExpiry(Date.now() + 10 * 60 * 1000); // 10 minutes
        setStep('voting');
        setError('');
      } else {
        setError(data.message || 'Verification failed');
      }
    } catch (error) {
      console.error('Verification error:', error);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVoteSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedHeadBoy && !selectedHeadGirl && !selectedSportsCaptain && !selectedSportsViceCaptain) {
      setError('Please select at least one candidate to vote for.');
      return;
    }

    if (!sessionToken) {
      setError('Session expired. Please verify again.');
      handleSessionExpiry();
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionToken,
          headBoyVote: selectedHeadBoy,
          headGirlVote: selectedHeadGirl,
          sportsCaptainVote: selectedSportsCaptain,
          sportsViceCaptainVote: selectedSportsViceCaptain
        })
      });

      const data = await response.json();

      if (data.success) {
        setStep('success');
        setSessionToken('');
        setSessionExpiry(null);
      } else {
        setError(data.message || 'Failed to submit vote');
        if (data.message?.includes('session') || data.message?.includes('expired')) {
          handleSessionExpiry();
        }
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!settings.votingEnabled) {
    return (
      <div className="max-w-2xl mx-auto mt-20 p-8">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <AlertCircle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Voting Currently Inactive</h2>
          <p className="text-gray-600">
            The voting system is currently disabled. Please contact your administrator
            or wait for the voting period to begin.
          </p>
        </div>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="max-w-2xl mx-auto mt-20 p-8">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Vote Submitted Successfully!</h2>
          <p className="text-gray-600 mb-6">
            Thank you for participating in the school elections. Your vote has been securely recorded.
          </p>
          <div className="bg-green-50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-center space-x-2 text-green-800">
              <Shield className="h-5 w-5" />
              <span className="text-sm font-medium">Your vote is protected and cannot be changed</span>
            </div>
          </div>
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Important:</strong> Each student can vote only once. Attempting to vote again will be blocked by our security system.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {step === 'verification' && (
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <UserCheck className="h-12 w-12 text-blue-600" />
              <Shield className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Student Verification</h2>
            <p className="text-gray-600">
              Please enter your details to verify your eligibility to vote
            </p>
          </div>

          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <div className="flex items-start space-x-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-2">How to fill the form:</p>
                <ul className="space-y-1 text-xs">
                  <li>• <strong>Name:</strong> Enter your full name as it appears in school records</li>
                  <li>• <strong>Class:</strong> Enter your class (e.g., 10, 11, 12, or 10A, 11B, etc.)</li>
                  <li>• <strong>Division:</strong> Enter your section/division (e.g., A, B, C, or 1, 2, 3)</li>
                  <li>• <strong>Date of Birth:</strong> Select your exact date of birth</li>
                </ul>
              </div>
            </div>
          </div>

          <form onSubmit={handleVerification} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={voterInfo.name}
                  onChange={(e) => setVoterInfo({ ...voterInfo, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your full name"
                  maxLength={100}
                />
                <p className="text-xs text-gray-500 mt-1">As it appears in school records</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Class *
                </label>
                <input
                  type="text"
                  required
                  value={voterInfo.class}
                  onChange={(e) => setVoterInfo({ ...voterInfo, class: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 12, 10A, 11B"
                  maxLength={10}
                />
                <p className="text-xs text-gray-500 mt-1">Your current class</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Division/Section *
                </label>
                <input
                  type="text"
                  required
                  value={voterInfo.division}
                  onChange={(e) => setVoterInfo({ ...voterInfo, division: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., A, B, C, 1, 2"
                  maxLength={5}
                />
                <p className="text-xs text-gray-500 mt-1">Your section/division</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date of Birth *
                </label>
                <input
                  type="date"
                  required
                  value={voterInfo.dateOfBirth}
                  onChange={(e) => setVoterInfo({ ...voterInfo, dateOfBirth: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  max={new Date().toISOString().split('T')[0]}
                  min={new Date(Date.now() - 30 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                />
                <p className="text-xs text-gray-500 mt-1">Your exact date of birth</p>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-2">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-800 text-sm font-medium">Verification Error</p>
                  <p className="text-red-700 text-sm mt-1">{error}</p>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <Shield className="h-5 w-5" />
                  <span>Verify & Continue to Vote</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {step === 'voting' && (
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <Users className="h-8 w-8 text-green-600" />
              <Trophy className="h-8 w-8 text-yellow-600" />
              <Medal className="h-8 w-8 text-orange-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Cast Your Vote</h2>
            <p className="text-gray-600">
              Select your preferred candidates for each position
            </p>
          </div>

          {/* Session Timer */}
          {sessionExpiry && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-yellow-600" />
                <span className="text-yellow-800 font-medium">
                  Session expires in: {formatTime(timeRemaining)}
                </span>
              </div>
              <p className="text-yellow-700 text-sm mt-1">
                Complete your voting before the session expires
              </p>
            </div>
          )}

          <form onSubmit={handleVoteSubmission} className="space-y-8">
            {/* Head Boy Candidates */}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm mr-3">
                  Head Boy
                </span>
                Select One Candidate (Optional)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {candidates.headBoy.map((candidate) => (
                  <div
                    key={candidate.id}
                    className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                      selectedHeadBoy === candidate.name
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-blue-25'
                    }`}
                    onClick={() => setSelectedHeadBoy(selectedHeadBoy === candidate.name ? '' : candidate.name)}
                  >
                    <div className="flex items-center space-x-3">
                      <input
                        type="radio"
                        name="headBoy"
                        value={candidate.name}
                        checked={selectedHeadBoy === candidate.name}
                        onChange={() => setSelectedHeadBoy(candidate.name)}
                        className="text-blue-600"
                      />
                      <span className="font-medium text-gray-900">{candidate.name}</span>
                    </div>
                  </div>
                ))}
                <div
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                    selectedHeadBoy === ''
                      ? 'border-gray-500 bg-gray-50 shadow-md'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedHeadBoy('')}
                >
                  <div className="flex items-center space-x-3">
                    <input
                      type="radio"
                      name="headBoy"
                      value=""
                      checked={selectedHeadBoy === ''}
                      onChange={() => setSelectedHeadBoy('')}
                      className="text-gray-600"
                    />
                    <span className="font-medium text-gray-600">Skip Head Boy Vote</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Head Girl Candidates */}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <span className="bg-pink-100 text-pink-800 px-3 py-1 rounded-full text-sm mr-3">
                  Head Girl
                </span>
                Select One Candidate (Optional)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {candidates.headGirl.map((candidate) => (
                  <div
                    key={candidate.id}
                    className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                      selectedHeadGirl === candidate.name
                        ? 'border-pink-500 bg-pink-50 shadow-md'
                        : 'border-gray-200 hover:border-pink-300 hover:bg-pink-25'
                    }`}
                    onClick={() => setSelectedHeadGirl(selectedHeadGirl === candidate.name ? '' : candidate.name)}
                  >
                    <div className="flex items-center space-x-3">
                      <input
                        type="radio"
                        name="headGirl"
                        value={candidate.name}
                        checked={selectedHeadGirl === candidate.name}
                        onChange={() => setSelectedHeadGirl(candidate.name)}
                        className="text-pink-600"
                      />
                      <span className="font-medium text-gray-900">{candidate.name}</span>
                    </div>
                  </div>
                ))}
                <div
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                    selectedHeadGirl === ''
                      ? 'border-gray-500 bg-gray-50 shadow-md'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedHeadGirl('')}
                >
                  <div className="flex items-center space-x-3">
                    <input
                      type="radio"
                      name="headGirl"
                      value=""
                      checked={selectedHeadGirl === ''}
                      onChange={() => setSelectedHeadGirl('')}
                      className="text-gray-600"
                    />
                    <span className="font-medium text-gray-600">Skip Head Girl Vote</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sports Captain Candidates */}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm mr-3 flex items-center space-x-1">
                  <Trophy className="h-4 w-4" />
                  <span>Sports Captain</span>
                </span>
                Select One Candidate (Optional)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {candidates.sportsCaptain.map((candidate) => (
                  <div
                    key={candidate.id}
                    className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                      selectedSportsCaptain === candidate.name
                        ? 'border-yellow-500 bg-yellow-50 shadow-md'
                        : 'border-gray-200 hover:border-yellow-300 hover:bg-yellow-25'
                    }`}
                    onClick={() => setSelectedSportsCaptain(selectedSportsCaptain === candidate.name ? '' : candidate.name)}
                  >
                    <div className="flex items-center space-x-3">
                      <input
                        type="radio"
                        name="sportsCaptain"
                        value={candidate.name}
                        checked={selectedSportsCaptain === candidate.name}
                        onChange={() => setSelectedSportsCaptain(candidate.name)}
                        className="text-yellow-600"
                      />
                      <span className="font-medium text-gray-900">{candidate.name}</span>
                    </div>
                  </div>
                ))}
                <div
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                    selectedSportsCaptain === ''
                      ? 'border-gray-500 bg-gray-50 shadow-md'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedSportsCaptain('')}
                >
                  <div className="flex items-center space-x-3">
                    <input
                      type="radio"
                      name="sportsCaptain"
                      value=""
                      checked={selectedSportsCaptain === ''}
                      onChange={() => setSelectedSportsCaptain('')}
                      className="text-gray-600"
                    />
                    <span className="font-medium text-gray-600">Skip Sports Captain Vote</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sports Vice Captain Candidates */}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm mr-3 flex items-center space-x-1">
                  <Medal className="h-4 w-4" />
                  <span>Sports Vice Captain</span>
                </span>
                Select One Candidate (Optional)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {candidates.sportsViceCaptain.map((candidate) => (
                  <div
                    key={candidate.id}
                    className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                      selectedSportsViceCaptain === candidate.name
                        ? 'border-orange-500 bg-orange-50 shadow-md'
                        : 'border-gray-200 hover:border-orange-300 hover:bg-orange-25'
                    }`}
                    onClick={() => setSelectedSportsViceCaptain(selectedSportsViceCaptain === candidate.name ? '' : candidate.name)}
                  >
                    <div className="flex items-center space-x-3">
                      <input
                        type="radio"
                        name="sportsViceCaptain"
                        value={candidate.name}
                        checked={selectedSportsViceCaptain === candidate.name}
                        onChange={() => setSelectedSportsViceCaptain(candidate.name)}
                        className="text-orange-600"
                      />
                      <span className="font-medium text-gray-900">{candidate.name}</span>
                    </div>
                  </div>
                ))}
                <div
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                    selectedSportsViceCaptain === ''
                      ? 'border-gray-500 bg-gray-50 shadow-md'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedSportsViceCaptain('')}
                >
                  <div className="flex items-center space-x-3">
                    <input
                      type="radio"
                      name="sportsViceCaptain"
                      value=""
                      checked={selectedSportsViceCaptain === ''}
                      onChange={() => setSelectedSportsViceCaptain('')}
                      className="text-gray-600"
                    />
                    <span className="font-medium text-gray-600">Skip Sports Vice Captain Vote</span>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-2">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Your Selections:</h4>
              <div className="space-y-1 text-sm text-gray-600">
                <p><strong>Head Boy:</strong> {selectedHeadBoy || 'Not selected'}</p>
                <p><strong>Head Girl:</strong> {selectedHeadGirl || 'Not selected'}</p>
                <p><strong>Sports Captain:</strong> {selectedSportsCaptain || 'Not selected'}</p>
                <p><strong>Sports Vice Captain:</strong> {selectedSportsViceCaptain || 'Not selected'}</p>
              </div>
            </div>

            <div className="flex space-x-4">
              <button
                type="button"
                onClick={handleSessionExpiry}
                className="flex-1 bg-gray-500 text-white py-3 px-6 rounded-lg hover:bg-gray-600 transition-colors font-medium"
              >
                Cancel & Start Over
              </button>
              <button
                type="submit"
                disabled={loading || (!selectedHeadBoy && !selectedHeadGirl && !selectedSportsCaptain && !selectedSportsViceCaptain)}
                className="flex-1 bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Submitting Vote...</span>
                  </>
                ) : (
                  <>
                    <Shield className="h-5 w-5" />
                    <span>Submit Secure Vote</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default VotingPage;