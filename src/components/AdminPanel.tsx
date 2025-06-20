import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Upload, 
  Users, 
  BarChart, 
  RefreshCw, 
  Download,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  CheckCircle,
  LogOut,
  Trophy,
  Medal,
  Trash2
} from 'lucide-react';
import VoteChart from './VoteChart';
import { API_URL } from '../config';

interface AdminPanelProps {
  onSettingsUpdate: () => void;
  onLogout: () => void;
}

interface StatsData {
  votes: {
    headBoy: Record<string, number>;
    headGirl: Record<string, number>;
    sportsCaptain: Record<string, number>;
    sportsViceCaptain: Record<string, number>;
  };
  totalVoters: number;
  students: any[];
  candidates: {
    headBoy: any[];
    headGirl: any[];
    sportsCaptain: any[];
    sportsViceCaptain: any[];
  };
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onSettingsUpdate, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'settings' | 'candidates' | 'stats' | 'voters'>('settings');
  const [settings, setSettings] = useState<{ votingEnabled: boolean }>({ votingEnabled: false });
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
    fetchStats();
  }, []);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('adminToken');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  const getAuthHeadersForUpload = () => {
    const token = localStorage.getItem('adminToken');
    return {
      'Authorization': `Bearer ${token}`
    };
  };

  const handleAuthError = (response: Response) => {
    if (response.status === 401) {
      localStorage.removeItem('adminToken');
      onLogout();
      return true;
    }
    return false;
  };

  const fetchSettings = async () => {
    try {
      const response = await fetch(`${API_URL}/api/settings`);
      const data = await response.json();
      setSettings(data);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/stats`, {
        headers: getAuthHeaders()
      });
      
      if (handleAuthError(response)) return;
      
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const toggleVoting = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/settings`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ votingEnabled: !settings.votingEnabled })
      });

      if (handleAuthError(response)) return;

      const data = await response.json();
      if (data.success) {
        setSettings(data.settings);
        onSettingsUpdate();
        showMessage('success', `Voting ${data.settings.votingEnabled ? 'enabled' : 'disabled'} successfully`);
      }
    } catch (error) {
      showMessage('error', 'Failed to update voting settings');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('excel', file);

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/upload-candidates`, {
        method: 'POST',
        headers: getAuthHeadersForUpload(),
        body: formData
      });

      if (handleAuthError(response)) return;

      const data = await response.json();
      if (data.success) {
        showMessage('success', data.message || 'Candidates uploaded successfully');
        fetchStats();
      } else {
        showMessage('error', data.message || 'Failed to upload candidates');
      }
    } catch (error) {
      showMessage('error', 'Failed to upload file');
    } finally {
      setLoading(false);
    }
  };

  const resetVoting = async () => {
    if (!confirm('Are you sure you want to reset all voting data? This action cannot be undone.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/reset`, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (handleAuthError(response)) return;

      const data = await response.json();
      if (data.success) {
        showMessage('success', 'Voting data reset successfully');
        fetchStats();
      } else {
        showMessage('error', 'Failed to reset voting data');
      }
    } catch (error) {
      showMessage('error', 'Failed to reset voting data');
    } finally {
      setLoading(false);
    }
  };

  const exportResults = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/export`, {
        headers: getAuthHeaders()
      });
      
      if (handleAuthError(response)) return;
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }
      
      const contentType = response.headers.get('content-type');
      console.log('Response content type:', contentType);
      
      // Check if it's an Excel file or if we should proceed anyway
      if (contentType && contentType.includes('spreadsheet')) {
        console.log('Valid Excel content type detected');
      } else if (contentType && contentType.includes('text/plain')) {
        // This is an error message
        const errorText = await response.text();
        throw new Error(errorText);
      } else {
        console.log('Unknown content type, proceeding with download');
      }
      
      const blob = await response.blob();
      console.log('Blob created, size:', blob.size, 'type:', blob.type);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `School-Election-Results-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      showMessage('success', 'Excel file downloaded successfully!');
    } catch (error) {
      console.error('Export error:', error);
      showMessage('error', 'Failed to export results: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    onLogout();
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleDeleteCandidate = async (position: string, id: number) => {
    if (!confirm('Are you sure you want to delete this candidate?')) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/candidates/${position}/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (handleAuthError(response)) return;

      const data = await response.json();
      if (data.success) {
        showMessage('success', 'Candidate deleted successfully');
        fetchStats();
      } else {
        showMessage('error', data.message || 'Failed to delete candidate');
      }
    } catch (error) {
      showMessage('error', 'Failed to delete candidate');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAllCandidates = async () => {
    if (!confirm('Are you sure you want to delete ALL candidates? This action cannot be undone.')) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/candidates`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (handleAuthError(response)) return;

      const data = await response.json();
      if (data.success) {
        showMessage('success', 'All candidates deleted successfully');
        fetchStats();
      } else {
        showMessage('error', data.message || 'Failed to delete candidates');
      }
    } catch (error) {
      showMessage('error', 'Failed to delete candidates');
    } finally {
      setLoading(false);
    }
  };

  const handleSymbolUpload = async (position: string, id: number, file: File) => {
    const formData = new FormData();
    formData.append('symbol', file);
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/candidates/${position}/${id}/symbol`, {
        method: 'POST',
        headers: getAuthHeadersForUpload(),
        body: formData
      });
      const data = await response.json();
      if (data.success) {
        showMessage('success', 'Symbol uploaded successfully');
        fetchStats();
      } else {
        showMessage('error', data.message || 'Failed to upload symbol');
      }
    } catch (error) {
      showMessage('error', 'Failed to upload symbol');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="bg-white rounded-xl shadow-lg">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                <Settings className="h-8 w-8 text-blue-600 mr-3" />
                Admin Panel
              </h1>
              <p className="text-gray-600 mt-1">Manage voting system and view results</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-4 py-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`mx-6 mt-4 p-4 rounded-lg flex items-center ${
            message.type === 'success' 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="h-5 w-5 mr-2" />
            ) : (
              <AlertCircle className="h-5 w-5 mr-2" />
            )}
            {message.text}
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="px-6 flex space-x-8">
            {[
              { id: 'settings', label: 'Settings', icon: Settings },
              { id: 'candidates', label: 'Candidates', icon: Users },
              { id: 'stats', label: 'Vote Stats', icon: BarChart },
              { id: 'voters', label: 'Voter List', icon: Users }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={`py-4 px-2 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Voting Control</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-700">Enable/Disable Voting</p>
                    <p className="text-sm text-gray-500">
                      Control whether students can submit votes
                    </p>
                  </div>
                  <button
                    onClick={toggleVoting}
                    disabled={loading}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium ${
                      settings.votingEnabled
                        ? 'bg-green-100 text-green-800 hover:bg-green-200'
                        : 'bg-red-100 text-red-800 hover:bg-red-200'
                    } disabled:opacity-50`}
                  >
                    {settings.votingEnabled ? (
                      <ToggleRight className="h-5 w-5" />
                    ) : (
                      <ToggleLeft className="h-5 w-5" />
                    )}
                    <span>{settings.votingEnabled ? 'Enabled' : 'Disabled'}</span>
                  </button>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Management</h3>
                <div className="space-y-4">
                  <button
                    onClick={resetVoting}
                    disabled={loading}
                    className="flex items-center space-x-2 px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200 disabled:opacity-50"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span>Reset All Voting Data</span>
                  </button>
                  
                  <button
                    onClick={exportResults}
                    disabled={loading}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download className="h-4 w-4" />
                    <span>{loading ? 'Exporting...' : 'Export Excel Report'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'candidates' && (
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Upload Candidates</h3>
                  <button
                    onClick={handleDeleteAllCandidates}
                    disabled={loading}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Delete All Candidates</span>
                  </button>
                </div>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <div className="space-y-2">
                    <p className="text-gray-600">Upload an Excel file with candidate data</p>
                    <p className="text-sm text-gray-500">
                      File must contain a sheet named "Candidates" with columns: name, position
                    </p>
                    <div className="text-xs text-gray-400 mt-2">
                      <p><strong>Accepted positions:</strong></p>
                      <p>• Head Boy, Head Girl</p>
                      <p>• Sports Captain, Sports Vice Captain</p>
                    </div>
                  </div>
                  <label className="mt-4 inline-block">
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={loading}
                    />
                    <span className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 cursor-pointer">
                      {loading ? 'Uploading...' : 'Choose File'}
                    </span>
                  </label>
                </div>
              </div>

              {stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-blue-50 rounded-lg p-6">
                    <h4 className="text-lg font-semibold text-blue-900 mb-3">Head Boy Candidates</h4>
                    <div className="space-y-2">
                      {stats.candidates.headBoy.map((candidate) => (
                        <div key={candidate.id} className="bg-white p-3 rounded-lg flex flex-col md:flex-row md:justify-between md:items-center space-y-2 md:space-y-0 md:space-x-4">
                          <div className="flex items-center space-x-3">
                            {/* Symbol preview */}
                            {candidate.symbol && candidate.symbol.startsWith('data:') ? (
                              <img src={candidate.symbol} alt="Symbol" className="h-16 w-16 object-contain" />
                            ) : candidate.symbol && candidate.symbol.endsWith('.pdf') ? (
                              <a href={`${API_URL}${candidate.symbol}`} target="_blank" rel="noopener noreferrer">View Symbol (PDF)</a>
                            ) : (
                              candidate.symbol && <img src={`${API_URL}${candidate.symbol}`} alt="Symbol" className="h-16 w-16 object-contain" />
                            )}
                          <span className="font-medium">{candidate.name}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <label className="inline-block">
                              <input
                                type="file"
                                accept=".jpg,.jpeg,.png,.pdf"
                                style={{ display: 'none' }}
                                onChange={e => {
                                  if (e.target.files && e.target.files[0]) {
                                    handleSymbolUpload('headBoy', candidate.id, e.target.files[0]);
                                  }
                                }}
                                disabled={loading}
                              />
                              <span className="bg-gray-200 text-gray-800 px-2 py-1 rounded cursor-pointer hover:bg-gray-300 text-xs">Upload Symbol</span>
                            </label>
                          <button
                            onClick={() => handleDeleteCandidate('headBoy', candidate.id)}
                            disabled={loading}
                            className="text-red-600 hover:text-red-700 disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          </div>
                        </div>
                      ))}
                      {stats.candidates.headBoy.length === 0 && (
                        <p className="text-gray-500 italic">No candidates uploaded yet</p>
                      )}
                    </div>
                  </div>

                  <div className="bg-pink-50 rounded-lg p-6">
                    <h4 className="text-lg font-semibold text-pink-900 mb-3">Head Girl Candidates</h4>
                    <div className="space-y-2">
                      {stats.candidates.headGirl.map((candidate) => (
                        <div key={candidate.id} className="bg-white p-3 rounded-lg flex flex-col md:flex-row md:justify-between md:items-center space-y-2 md:space-y-0 md:space-x-4">
                          <div className="flex items-center space-x-3">
                            {/* Symbol preview */}
                            {candidate.symbol && candidate.symbol.startsWith('data:') ? (
                              <img src={candidate.symbol} alt="Symbol" className="h-16 w-16 object-contain" />
                            ) : candidate.symbol && candidate.symbol.endsWith('.pdf') ? (
                              <a href={`${API_URL}${candidate.symbol}`} target="_blank" rel="noopener noreferrer">View Symbol (PDF)</a>
                            ) : (
                              candidate.symbol && <img src={`${API_URL}${candidate.symbol}`} alt="Symbol" className="h-16 w-16 object-contain" />
                            )}
                          <span className="font-medium">{candidate.name}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <label className="inline-block">
                              <input
                                type="file"
                                accept=".jpg,.jpeg,.png,.pdf"
                                style={{ display: 'none' }}
                                onChange={e => {
                                  if (e.target.files && e.target.files[0]) {
                                    handleSymbolUpload('headGirl', candidate.id, e.target.files[0]);
                                  }
                                }}
                                disabled={loading}
                              />
                              <span className="bg-gray-200 text-gray-800 px-2 py-1 rounded cursor-pointer hover:bg-gray-300 text-xs">Upload Symbol</span>
                            </label>
                          <button
                            onClick={() => handleDeleteCandidate('headGirl', candidate.id)}
                            disabled={loading}
                            className="text-red-600 hover:text-red-700 disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          </div>
                        </div>
                      ))}
                      {stats.candidates.headGirl.length === 0 && (
                        <p className="text-gray-500 italic">No candidates uploaded yet</p>
                      )}
                    </div>
                  </div>

                  <div className="bg-yellow-50 rounded-lg p-6">
                    <h4 className="text-lg font-semibold text-yellow-900 mb-3 flex items-center">
                      <Trophy className="h-5 w-5 mr-2" />
                      Sports Captain Candidates
                    </h4>
                    <div className="space-y-2">
                      {stats.candidates.sportsCaptain.map((candidate) => (
                        <div key={candidate.id} className="bg-white p-3 rounded-lg flex flex-col md:flex-row md:justify-between md:items-center space-y-2 md:space-y-0 md:space-x-4">
                          <div className="flex items-center space-x-3">
                            {/* Symbol preview */}
                            {candidate.symbol && candidate.symbol.startsWith('data:') ? (
                              <img src={candidate.symbol} alt="Symbol" className="h-16 w-16 object-contain" />
                            ) : candidate.symbol && candidate.symbol.endsWith('.pdf') ? (
                              <a href={`${API_URL}${candidate.symbol}`} target="_blank" rel="noopener noreferrer">View Symbol (PDF)</a>
                            ) : (
                              candidate.symbol && <img src={`${API_URL}${candidate.symbol}`} alt="Symbol" className="h-16 w-16 object-contain" />
                            )}
                          <span className="font-medium">{candidate.name}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <label className="inline-block">
                              <input
                                type="file"
                                accept=".jpg,.jpeg,.png,.pdf"
                                style={{ display: 'none' }}
                                onChange={e => {
                                  if (e.target.files && e.target.files[0]) {
                                    handleSymbolUpload('sportsCaptain', candidate.id, e.target.files[0]);
                                  }
                                }}
                                disabled={loading}
                              />
                              <span className="bg-gray-200 text-gray-800 px-2 py-1 rounded cursor-pointer hover:bg-gray-300 text-xs">Upload Symbol</span>
                            </label>
                          <button
                            onClick={() => handleDeleteCandidate('sportsCaptain', candidate.id)}
                            disabled={loading}
                            className="text-red-600 hover:text-red-700 disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          </div>
                        </div>
                      ))}
                      {stats.candidates.sportsCaptain.length === 0 && (
                        <p className="text-gray-500 italic">No candidates uploaded yet</p>
                      )}
                    </div>
                  </div>

                  <div className="bg-orange-50 rounded-lg p-6">
                    <h4 className="text-lg font-semibold text-orange-900 mb-3 flex items-center">
                      <Medal className="h-5 w-5 mr-2" />
                      Sports Vice Captain Candidates
                    </h4>
                    <div className="space-y-2">
                      {stats.candidates.sportsViceCaptain.map((candidate) => (
                        <div key={candidate.id} className="bg-white p-3 rounded-lg flex flex-col md:flex-row md:justify-between md:items-center space-y-2 md:space-y-0 md:space-x-4">
                          <div className="flex items-center space-x-3">
                            {/* Symbol preview */}
                            {candidate.symbol && candidate.symbol.startsWith('data:') ? (
                              <img src={candidate.symbol} alt="Symbol" className="h-16 w-16 object-contain" />
                            ) : candidate.symbol && candidate.symbol.endsWith('.pdf') ? (
                              <a href={`${API_URL}${candidate.symbol}`} target="_blank" rel="noopener noreferrer">View Symbol (PDF)</a>
                            ) : (
                              candidate.symbol && <img src={`${API_URL}${candidate.symbol}`} alt="Symbol" className="h-16 w-16 object-contain" />
                            )}
                          <span className="font-medium">{candidate.name}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <label className="inline-block">
                              <input
                                type="file"
                                accept=".jpg,.jpeg,.png,.pdf"
                                style={{ display: 'none' }}
                                onChange={e => {
                                  if (e.target.files && e.target.files[0]) {
                                    handleSymbolUpload('sportsViceCaptain', candidate.id, e.target.files[0]);
                                  }
                                }}
                                disabled={loading}
                              />
                              <span className="bg-gray-200 text-gray-800 px-2 py-1 rounded cursor-pointer hover:bg-gray-300 text-xs">Upload Symbol</span>
                            </label>
                          <button
                            onClick={() => handleDeleteCandidate('sportsViceCaptain', candidate.id)}
                            disabled={loading}
                            className="text-red-600 hover:text-red-700 disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          </div>
                        </div>
                      ))}
                      {stats.candidates.sportsViceCaptain.length === 0 && (
                        <p className="text-gray-500 italic">No candidates uploaded yet</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'stats' && stats && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-blue-50 rounded-lg p-6 text-center">
                  <div className="text-3xl font-bold text-blue-600">{stats.totalVoters}</div>
                  <div className="text-blue-800 font-medium">Total Votes Cast</div>
                </div>
                <div className="bg-green-50 rounded-lg p-6 text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {Object.values(stats.votes.headBoy).reduce((a, b) => a + b, 0)}
                  </div>
                  <div className="text-green-800 font-medium">Head Boy Votes</div>
                </div>
                <div className="bg-pink-50 rounded-lg p-6 text-center">
                  <div className="text-3xl font-bold text-pink-600">
                    {Object.values(stats.votes.headGirl).reduce((a, b) => a + b, 0)}
                  </div>
                  <div className="text-pink-800 font-medium">Head Girl Votes</div>
                </div>
                <div className="bg-yellow-50 rounded-lg p-6 text-center">
                  <div className="text-3xl font-bold text-yellow-600">
                    {Object.values(stats.votes.sportsCaptain).reduce((a, b) => a + b, 0) + 
                     Object.values(stats.votes.sportsViceCaptain).reduce((a, b) => a + b, 0)}
                  </div>
                  <div className="text-yellow-800 font-medium">Sports Votes</div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <VoteChart
                  title="Head Boy Votes"
                  data={stats.votes.headBoy}
                  color="blue"
                />
                <VoteChart
                  title="Head Girl Votes"
                  data={stats.votes.headGirl}
                  color="pink"
                />
                <VoteChart
                  title="Sports Captain Votes"
                  data={stats.votes.sportsCaptain}
                  color="yellow"
                />
                <VoteChart
                  title="Sports Vice Captain Votes"
                  data={stats.votes.sportsViceCaptain}
                  color="orange"
                />
              </div>
            </div>
          )}

          {activeTab === 'voters' && stats && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Students Who Have Voted ({stats.totalVoters})
              </h3>
              <div className="bg-gray-50 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Division</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Voted At</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {stats.students.map((student, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {student.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {student.class}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {student.division}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(student.votedAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {stats.students.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-gray-500">No votes have been cast yet</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;