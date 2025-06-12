import React, { useState, useEffect } from 'react';
import { CheckCircle, UserCheck, Users, AlertCircle } from 'lucide-react';

interface Candidate {
  id: number;
  name: string;
  gender: string;
}

interface CandidatesData {
  headBoy: Candidate[];
  headGirl: Candidate[];
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
  const [candidates, setCandidates] = useState<CandidatesData>({ headBoy: [], headGirl: [] });
  const [voterInfo, setVoterInfo] = useState<VoterInfo>({
    name: '',
    class: '',
    division: '',
    dateOfBirth: ''
  });
  const [selectedHeadBoy, setSelectedHeadBoy] = useState<string>('');
  const [selectedHeadGirl, setSelectedHeadGirl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [voterKey, setVoterKey] = useState('');

  useEffect(() => {
    fetchCandidates();
  }, []);

  const fetchCandidates = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/candidates');
      const data = await response.json();
      setCandidates(data);
    } catch (error) {
      console.error('Error fetching candidates:', error);
      setError('Failed to load candidates');
    }
  };

  const handleVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:3001/api/check-voter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(voterInfo)
      });

      const data = await response.json();

      if (data.hasVoted) {
        setError('You have already cast your vote. Each student can vote only once.');
      } else {
        setVoterKey(data.voterKey);
        setStep('voting');
      }
    } catch (error) {
      setError('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVoteSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedHeadBoy && !selectedHeadGirl) {
      setError('Please select at least one candidate to vote for.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:3001/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voterKey,
          headBoyVote: selectedHeadBoy,
          headGirlVote: selectedHeadGirl,
          voterInfo
        })
      });

      const data = await response.json();

      if (data.success) {
        setStep('success');
      } else {
        setError(data.message || 'Failed to submit vote');
      }
    } catch (error) {
      setError('Failed to submit vote. Please try again.');
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
            Thank you for participating in the school elections. Your vote has been recorded.
          </p>
          <div className="bg-green-50 rounded-lg p-4">
            <p className="text-sm text-green-800">
              Remember: Each student can vote only once. Your participation helps shape our school's future!
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {step === 'verification' && (
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-8">
            <UserCheck className="h-12 w-12 text-blue-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Voter Verification</h2>
            <p className="text-gray-600">
              Please enter your details to verify your eligibility to vote
            </p>
          </div>

          <form onSubmit={handleVerification} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={voterInfo.name}
                  onChange={(e) => setVoterInfo({ ...voterInfo, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Class
                </label>
                <input
                  type="text"
                  required
                  value={voterInfo.class}
                  onChange={(e) => setVoterInfo({ ...voterInfo, class: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 12"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Division/Section
                </label>
                <input
                  type="text"
                  required
                  value={voterInfo.division}
                  onChange={(e) => setVoterInfo({ ...voterInfo, division: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., A"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date of Birth
                </label>
                <input
                  type="date"
                  required
                  value={voterInfo.dateOfBirth}
                  onChange={(e) => setVoterInfo({ ...voterInfo, dateOfBirth: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {loading ? 'Verifying...' : 'Verify & Continue to Vote'}
            </button>
          </form>
        </div>
      )}

      {step === 'voting' && (
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-8">
            <Users className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Cast Your Vote</h2>
            <p className="text-gray-600">
              Select your preferred candidates for Head Boy and Head Girl
            </p>
          </div>

          <form onSubmit={handleVoteSubmission} className="space-y-8">
            {/* Head Boy Candidates */}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm mr-3">
                  Head Boy
                </span>
                Select One Candidate
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {candidates.headBoy.map((candidate) => (
                  <div
                    key={candidate.id}
                    className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                      selectedHeadBoy === candidate.name
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-blue-25'
                    }`}
                    onClick={() => setSelectedHeadBoy(candidate.name)}
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
              </div>
            </div>

            {/* Head Girl Candidates */}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <span className="bg-pink-100 text-pink-800 px-3 py-1 rounded-full text-sm mr-3">
                  Head Girl
                </span>
                Select One Candidate
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {candidates.headGirl.map((candidate) => (
                  <div
                    key={candidate.id}
                    className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                      selectedHeadGirl === candidate.name
                        ? 'border-pink-500 bg-pink-50'
                        : 'border-gray-200 hover:border-pink-300 hover:bg-pink-25'
                    }`}
                    onClick={() => setSelectedHeadGirl(candidate.name)}
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
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => setStep('verification')}
                className="flex-1 bg-gray-500 text-white py-3 px-6 rounded-lg hover:bg-gray-600 transition-colors font-medium"
              >
                Back to Verification
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {loading ? 'Submitting Vote...' : 'Submit Vote'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default VotingPage;