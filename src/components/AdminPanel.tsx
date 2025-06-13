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
  Trash2
} from 'lucide-react';
import VoteChart from './VoteChart';

interface AdminPanelProps {
  onSettingsUpdate: () => void;
  onLogout: () => void;
}

interface StatsData {
  votes: {
    headBoy: Record<string, number>;
    headGirl: Record<string, number>;
  };
  totalVoters: number;
  students: any[];
  candidates: {
    headBoy: any[];
    headGirl: any[];
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
      'Authorization': token ? `Bearer ${token}` : '',
      'Accept': 'application/json'
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
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/settings`);
      const data = await response.json();
      setSettings(data);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/stats`, {
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
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/settings`, {
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
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/upload-candidates`, {
        method: 'POST',
        headers: getAuthHeadersForUpload(),
        body: formData
      });

      if (handleAuthError(response)) return;

      const data = await response.json();
      if (data.success) {
        showMessage('success', 'Candidates uploaded successfully');
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
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/reset`, {
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
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/export`, {
        headers: getAuthHeaders()
      });
      
      if (handleAuthError(response)) return;
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `voting-results-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showMessage('success', 'Results exported successfully');
    } catch (error) {
      showMessage('error', 'Failed to export results');
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

  const handleDeleteCandidate = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this candidate?')) {
      return;
    }

    setLoading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL;
      if (!apiUrl) {
        throw new Error('API URL is not configured');
      }

      const response = await fetch(`${apiUrl}/api/candidates/${id}`, {
        method: 'DELETE',
        headers: {
          ...getAuthHeaders(),
          'Accept': 'application/json'
        },
        mode: 'cors',
        credentials: 'same-origin'
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server response:', errorText);
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        // Update the candidates in the stats
        setStats(prevStats => ({
          ...prevStats,
          candidates: data.candidates
        }));
        showMessage('success', data.message || 'Candidate deleted successfully');
      } else {
        throw new Error(data.message || 'Failed to delete candidate');
      }
    } catch (error) {
      console.error('Error deleting candidate:', error);
      showMessage('error', error.message || 'Failed to delete candidate');
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
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200"
                  >
                    <Download className="h-4 w-4" />
                    <span>Export Results</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'candidates' && (
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload Candidates</h3>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <div className="space-y-2">
                    <p className="text-gray-600">Upload an Excel file with candidate data</p>
                    <p className="text-sm text-gray-500">
                      File must contain a sheet named "Candidates" with columns: name, gender
                    </p>
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
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold mb-4">Head Boy Candidates</h3>
                    <div className="space-y-2">
                      {stats.candidates.headBoy.map(candidate => (
                        <div key={candidate.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span>{candidate.name}</span>
                          <button
                            onClick={() => handleDeleteCandidate(candidate.id)}
                            className="text-red-600 hover:text-red-800 p-1"
                            title="Delete candidate"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold mb-4">Head Girl Candidates</h3>
                    <div className="space-y-2">
                      {stats.candidates.headGirl.map(candidate => (
                        <div key={candidate.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span>{candidate.name}</span>
                          <button
                            onClick={() => handleDeleteCandidate(candidate.id)}
                            className="text-red-600 hover:text-red-800 p-1"
                            title="Delete candidate"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'stats' && stats && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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