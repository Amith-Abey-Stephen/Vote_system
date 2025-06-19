import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import VotingPage from './components/VotingPage';
import AdminPanel from './components/AdminPanel';
import AdminLogin from './components/AdminLogin';
// import { Vote, Settings, Users } from 'lucide-react';
import { API_URL } from './config';
import header_logo from './assets/header-logo.png';

function App() {
  const [settings, setSettings] = useState<{ votingEnabled: boolean } | null>(null);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    fetchSettings();
    checkAdminAuth();
  }, []);

  const checkAdminAuth = () => {
    const token = localStorage.getItem('adminToken');
    setIsAdminAuthenticated(!!token);
    setIsCheckingAuth(false);
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

  const handleAdminLogin = () => {
    setIsAdminAuthenticated(true);
  };

  const handleAdminLogout = () => {
    setIsAdminAuthenticated(false);
  };

  if (!settings) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading School Voting System...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center">
                <img src={header_logo} className="h-12 w-auto" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="flex flex-col items-center">
                  <h1 className="hidden sm:block text-xl font-bold text-gray-900"> Students' Council Election</h1>
                  {/* <p className="hidden sm:block text-sm text-gray-600">Head Boy & Head Girl Elections</p> */}
                </div>
              </div>
              <div className="w-12"></div> {/* Spacer to balance the layout */}
              <div className="flex items-center space-x-4">
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  settings.votingEnabled 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {settings.votingEnabled ? 'Voting Active' : 'Voting Inactive'}
                </div>
              </div>
            </div>
          </div>
        </header>

        <Routes>
          <Route path="/" element={<VotingPage settings={settings} />} />
          <Route 
            path="/admin" 
            element={
              isCheckingAuth ? (
                <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Checking authentication...</p>
                  </div>
                </div>
              ) : isAdminAuthenticated ? (
                <AdminPanel onSettingsUpdate={fetchSettings} onLogout={handleAdminLogout} />
              ) : (
                <AdminLogin onLogin={handleAdminLogin} />
              )
            } 
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;