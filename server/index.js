import express from 'express';
import cors from 'cors';
import multer from 'multer';
import XLSX from 'xlsx';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import crypto from 'crypto';
import path from 'path';
import fsExtra from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors({
  origin: ['https://yourvote.vercel.app', 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
  credentials: true
}));
app.use(express.json());

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `candidates-${Date.now()}.xlsx`);
  }
});

const upload = multer({ storage });

// Add symbol upload endpoint for candidates
const symbolStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const ext = file.originalname.split('.').pop();
    cb(null, `symbol-${Date.now()}.${ext}`);
  }
});
const symbolUpload = multer({ storage: symbolStorage });

// Data file paths
const dataDir = join(__dirname, 'data');
const studentsFile = join(dataDir, 'students.json');
const votesFile = join(dataDir, 'votes.json');
const candidatesFile = join(dataDir, 'candidates.json');
const settingsFile = join(dataDir, 'settings.json');
const adminsFile = join(dataDir, 'admins.json');

// In-memory session tracking to prevent duplicate votes within same session
const votingSessions = new Map();
const verifiedSessions = new Map();

// Rate limiting to prevent spam
const rateLimitMap = new Map();

// Initialize data files
async function initializeData() {
  try {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.mkdir('uploads', { recursive: true });

    // Initialize files if they don't exist
    const files = [
      { path: studentsFile, data: [] },
      { path: votesFile, data: { headBoy: {}, headGirl: {}, sportsCaptain: {}, sportsViceCaptain: {} } },
      { path: candidatesFile, data: { headBoy: [], headGirl: [], sportsCaptain: [], sportsViceCaptain: [] } },
      { path: settingsFile, data: { votingEnabled: false } },
      { 
        path: adminsFile, 
        data: { 
          admins: [
            { username: 'admin', password: 'admin123' },
            { username: 'principal', password: 'school2024' },
            { username: 'teacher', password: 'voting123' }
          ]
        }
      }
    ];

    for (const file of files) {
      try {
        await fs.access(file.path);
      } catch {
        await fs.writeFile(file.path, JSON.stringify(file.data, null, 2));
      }
    }
  } catch (error) {
    console.error('Error initializing data:', error);
  }
}

// Helper functions
async function readJsonFile(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
    return null;
  }
}

async function writeJsonFile(filePath, data) {
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Error writing ${filePath}:`, error);
    return false;
  }
}

// Generate secure voter key with hash
function generateVoterKey(name, studentClass, division) {
  const rawKey = `${name.toLowerCase().trim()}_${studentClass.trim()}_${division.trim()}`;
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

// Generate session token
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Rate limiting middleware - more lenient for verification
function rateLimit(req, res, next) {
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  const maxRequests = 50; // Increased from 10 to 20 requests per minute per IP
  
  if (!rateLimitMap.has(clientIP)) {
    rateLimitMap.set(clientIP, { count: 1, resetTime: now + windowMs });
    return next();
  }

  const clientData = rateLimitMap.get(clientIP);
  
  if (now > clientData.resetTime) {
    // Reset the window
    rateLimitMap.set(clientIP, { count: 1, resetTime: now + windowMs });
    return next();
  }

  if (clientData.count >= maxRequests) {
    return res.status(429).json({ 
      success: false, 
      message: 'Too many requests. Please wait a moment before trying again.' 
    });
  }

  clientData.count++;
  next();
}

// Input validation and sanitization - more flexible
function validateVoterInfo(voterInfo) {
  const { name, class: studentClass, division } = voterInfo;
  if (!name || !studentClass || !division) {
    return { valid: false, message: 'All fields are required' };
  }
  const cleanName = name.trim();
  if (!cleanName || cleanName.length < 2 || cleanName.length > 100) {
    return { valid: false, message: 'Name must be between 2-100 characters' };
  }
  if (!/^[a-zA-Z\s\-'.]+$/.test(cleanName)) {
    return { valid: false, message: 'Name can only contain letters, spaces, hyphens, apostrophes, and dots' };
  }
  const cleanClass = studentClass.trim().toUpperCase();
  if (!cleanClass || cleanClass.length > 10) {
    return { valid: false, message: 'Class field is required and must be under 10 characters' };
  }
  const cleanDivision = division.trim().toUpperCase();
  if (!cleanDivision || cleanDivision.length > 5) {
    return { valid: false, message: 'Division field is required and must be under 5 characters' };
  }
  return { valid: true };
}

// Admin authentication
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    const adminData = await readJsonFile(adminsFile);
    if (!adminData) {
      return res.status(500).json({ success: false, message: 'Failed to load admin data' });
    }

    const admin = adminData.admins.find(a => a.username === username && a.password === password);
    
    if (admin) {
      // In a real application, you would generate a JWT token here
      res.json({ 
        success: true, 
        message: 'Login successful',
        token: `admin_${username}_${Date.now()}` // Simple token for demo
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid username or password' });
    }
  } catch (error) {
    console.error('Error during admin login:', error);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
});

// Middleware to check admin authentication
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token || !token.startsWith('admin_')) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  
  next();
}

// Routes

// Get voting settings
app.get('/api/settings', async (req, res) => {
  const settings = await readJsonFile(settingsFile);
  res.json(settings);
});

// Update voting settings (protected)
app.post('/api/settings', requireAuth, async (req, res) => {
  const { votingEnabled } = req.body;
  const settings = { votingEnabled };
  const success = await writeJsonFile(settingsFile, settings);
  
  if (success) {
    // Clear all sessions when voting is disabled
    if (!votingEnabled) {
      votingSessions.clear();
      verifiedSessions.clear();
    }
    res.json({ success: true, settings });
  } else {
    res.status(500).json({ success: false, message: 'Failed to update settings' });
  }
});

// Get candidates
app.get('/api/candidates', async (req, res) => {
  const candidates = await readJsonFile(candidatesFile);
  res.json(candidates);
});

// Upload candidates from Excel (protected)
app.post('/api/upload-candidates', requireAuth, upload.single('excel'), async function (req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    console.log('Processing uploaded file:', req.file.filename);

    const workbook = XLSX.readFile(req.file.path);
    console.log('Available sheets:', workbook.SheetNames);
    
    const sheetName = 'Candidates';
    
    if (!workbook.SheetNames.includes(sheetName)) {
      return res.status(400).json({ 
        success: false, 
        message: `Excel file must contain a sheet named "Candidates". Found sheets: ${workbook.SheetNames.join(', ')}` 
      });
    }

    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    console.log('Raw data from Excel:', data);

    const candidates = { headBoy: [], headGirl: [], sportsCaptain: [], sportsViceCaptain: [] };
    const errors = [];

    // Use Promise.all to handle async logo checks
    await Promise.all(data.map(async (row, index) => {
      console.log(`Processing row ${index + 1}:`, row);
      
      if (!row.name || !row.position) {
        errors.push(`Row ${index + 2}: Missing name or position`);
        return;
      }

      // Ignore logo column from Excel
      let logo = '';

      const candidate = {
        id: Date.now() + Math.random(),
        name: row.name.toString().trim(),
        position: row.position.toString().toLowerCase().trim(),
        logo
      };

      console.log(`Processed candidate:`, candidate);

      // Accept multiple position formats
      switch (candidate.position) {
        case 'head boy':
        case 'headboy':
        case 'hb':
          candidates.headBoy.push({
            ...candidate,
            position: 'headBoy'
          });
          console.log(`Added to headBoy:`, candidate.name);
          break;
          
        case 'head girl':
        case 'headgirl':
        case 'hg':
          candidates.headGirl.push({
            ...candidate,
            position: 'headGirl'
          });
          console.log(`Added to headGirl:`, candidate.name);
          break;
          
        case 'sports captain':
        case 'sportscaptain':
        case 'sc':
        case 'captain':
          candidates.sportsCaptain.push({
            ...candidate,
            position: 'sportsCaptain'
          });
          console.log(`Added to sportsCaptain:`, candidate.name);
          break;
          
        case 'sports vice captain':
        case 'sportsvcaptain':
        case 'vice captain':
        case 'vicecaptain':
        case 'svc':
        case 'vc':
          candidates.sportsViceCaptain.push({
            ...candidate,
            position: 'sportsViceCaptain'
          });
          console.log(`Added to sportsViceCaptain:`, candidate.name);
          break;
          
        default:
          errors.push(`Row ${index + 2}: Invalid position "${candidate.position}". Use: head boy, head girl, sports captain, sports vice captain`);
      }
    }));

    console.log('Final candidates:', candidates);
    console.log('Errors:', errors);

    if (errors.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'File processing errors:\n' + errors.join('\n'),
        errors 
      });
    }

    const totalCandidates = candidates.headBoy.length + candidates.headGirl.length + 
                           candidates.sportsCaptain.length + candidates.sportsViceCaptain.length;

    if (totalCandidates === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No valid candidates found. Please check your Excel file format.' 
      });
    }

    const success = await writeJsonFile(candidatesFile, candidates);
    
    if (success) {
      console.log('Candidates saved successfully');
      res.json({ 
        success: true, 
        candidates,
        message: `Successfully uploaded ${candidates.headBoy.length} Head Boy, ${candidates.headGirl.length} Head Girl, ${candidates.sportsCaptain.length} Sports Captain, and ${candidates.sportsViceCaptain.length} Sports Vice Captain candidates`
      });
    } else {
      res.status(500).json({ success: false, message: 'Failed to save candidates' });
    }

    // Clean up uploaded file
    await fs.unlink(req.file.path);
  } catch (error) {
    console.error('Error processing Excel file:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error processing Excel file: ' + error.message 
    });
  }
});

// Delete a specific candidate (protected)
app.delete('/api/candidates/:position/:id', requireAuth, async (req, res) => {
  try {
    const { position, id } = req.params;
    const candidates = await readJsonFile(candidatesFile);
    
    if (!candidates[position]) {
      return res.status(400).json({ success: false, message: 'Invalid position' });
    }

    const initialLength = candidates[position].length;
    candidates[position] = candidates[position].filter(c => c.id !== parseFloat(id));

    if (candidates[position].length === initialLength) {
      return res.status(404).json({ success: false, message: 'Candidate not found' });
    }

    const success = await writeJsonFile(candidatesFile, candidates);
    
    if (success) {
      res.json({ success: true, message: 'Candidate deleted successfully' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to delete candidate' });
    }
  } catch (error) {
    console.error('Error deleting candidate:', error);
    res.status(500).json({ success: false, message: 'Error deleting candidate' });
  }
});

// Delete all candidates (protected)
app.delete('/api/candidates', requireAuth, async (req, res) => {
  try {
    const emptyCandidates = { headBoy: [], headGirl: [], sportsCaptain: [], sportsViceCaptain: [] };
    const success = await writeJsonFile(candidatesFile, emptyCandidates);
    
    if (success) {
      res.json({ success: true, message: 'All candidates deleted successfully' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to delete candidates' });
    }
  } catch (error) {
    console.error('Error deleting candidates:', error);
    res.status(500).json({ success: false, message: 'Error deleting candidates' });
  }
});

// Check if student has voted and create verification session
app.post('/api/check-voter', rateLimit, async (req, res) => {
  try {
    console.log('Verification request received:', req.body);
    
    const voterInfo = req.body;
    
    // Validate input
    const validation = validateVoterInfo(voterInfo);
    if (!validation.valid) {
      console.log('Validation failed:', validation.message);
      return res.status(400).json({ success: false, message: validation.message });
    }

    const { name, class: studentClass, division } = voterInfo;
    const voterKey = generateVoterKey(name, studentClass, division);
    
    console.log('Generated voter key:', voterKey.substring(0, 8) + '...');
    
    // Check if already voted in database
    const students = await readJsonFile(studentsFile);
    const hasVoted = students.some(student => student.voterKey === voterKey);
    
    if (hasVoted) {
      console.log('Student has already voted');
      return res.json({ 
        success: false, 
        hasVoted: true, 
        message: 'This student has already voted' 
      });
    }

    // Check if currently in a voting session
    if (votingSessions.has(voterKey)) {
      console.log('Student already in voting session');
      return res.json({ 
        success: false, 
        hasVoted: true, 
        message: 'Voting session already in progress for this student' 
      });
    }

    // Create verification session
    const sessionToken = generateSessionToken();
    verifiedSessions.set(sessionToken, {
      voterKey,
      voterInfo,
      timestamp: Date.now(),
      verified: true
    });

    console.log('Verification session created:', sessionToken.substring(0, 8) + '...');

    // Auto-expire session after 10 minutes
    setTimeout(() => {
      verifiedSessions.delete(sessionToken);
      console.log('Session expired:', sessionToken.substring(0, 8) + '...');
    }, 10 * 60 * 1000);

    res.json({ 
      success: true, 
      hasVoted: false, 
      sessionToken,
      message: 'Verification successful' 
    });
  } catch (error) {
    console.error('Error checking voter:', error);
    res.status(500).json({ success: false, message: 'Verification failed. Please try again.' });
  }
});

// Submit vote with session validation
app.post('/api/vote', rateLimit, async (req, res) => {
  try {
    const { sessionToken, headBoyVote, headGirlVote, sportsCaptainVote, sportsViceCaptainVote } = req.body;
    
    console.log('Vote submission received for session:', sessionToken?.substring(0, 8) + '...');
    
    // Check if voting is enabled
    const settings = await readJsonFile(settingsFile);
    if (!settings.votingEnabled) {
      return res.status(400).json({ success: false, message: 'Voting is currently disabled' });
    }

    // Validate session token
    if (!sessionToken || !verifiedSessions.has(sessionToken)) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid or expired session. Please verify again.' 
      });
    }

    const session = verifiedSessions.get(sessionToken);
    const { voterKey, voterInfo } = session;

    // Double-check if student has already voted
    const students = await readJsonFile(studentsFile);
    const hasVoted = students.some(student => student.voterKey === voterKey);
    
    if (hasVoted) {
      verifiedSessions.delete(sessionToken);
      return res.status(400).json({ success: false, message: 'Vote already recorded for this student' });
    }

    // Check if already in voting process
    if (votingSessions.has(voterKey)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Vote submission already in progress' 
      });
    }

    // Validate vote selections
    if (!headBoyVote && !headGirlVote && !sportsCaptainVote && !sportsViceCaptainVote) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please select at least one candidate' 
      });
    }

    // Mark as currently voting to prevent concurrent submissions
    votingSessions.set(voterKey, { timestamp: Date.now() });

    try {
      // Record the vote
      const votes = await readJsonFile(votesFile);
      
      if (headBoyVote) {
        votes.headBoy[headBoyVote] = (votes.headBoy[headBoyVote] || 0) + 1;
      }
      
      if (headGirlVote) {
        votes.headGirl[headGirlVote] = (votes.headGirl[headGirlVote] || 0) + 1;
      }

      if (sportsCaptainVote) {
        votes.sportsCaptain[sportsCaptainVote] = (votes.sportsCaptain[sportsCaptainVote] || 0) + 1;
      }

      if (sportsViceCaptainVote) {
        votes.sportsViceCaptain[sportsViceCaptainVote] = (votes.sportsViceCaptain[sportsViceCaptainVote] || 0) + 1;
      }

      // Add student to voted list
      students.push({
        voterKey,
        ...voterInfo,
        votedAt: new Date().toISOString(),
        headBoyVote: headBoyVote || null,
        headGirlVote: headGirlVote || null,
        sportsCaptainVote: sportsCaptainVote || null,
        sportsViceCaptainVote: sportsViceCaptainVote || null,
        sessionToken: sessionToken.substring(0, 8) // Store partial token for audit
      });

      // Save both files atomically
      const votesSuccess = await writeJsonFile(votesFile, votes);
      const studentsSuccess = await writeJsonFile(studentsFile, students);

      if (votesSuccess && studentsSuccess) {
        // Clean up sessions
        verifiedSessions.delete(sessionToken);
        votingSessions.delete(voterKey);
        
        console.log('Vote recorded successfully for:', voterInfo.name);
        res.json({ success: true, message: 'Vote recorded successfully' });
      } else {
        throw new Error('Failed to save vote data');
      }
    } catch (error) {
      // Remove from voting sessions on error
      votingSessions.delete(voterKey);
      throw error;
    }
  } catch (error) {
    console.error('Error recording vote:', error);
    res.status(500).json({ success: false, message: 'Error recording vote' });
  }
});

// Get vote statistics (protected)
app.get('/api/admin/stats', requireAuth, async (req, res) => {
  const votes = await readJsonFile(votesFile);
  const students = await readJsonFile(studentsFile);
  const candidates = await readJsonFile(candidatesFile);
  
  res.json({
    votes,
    totalVoters: students.length,
    students,
    candidates,
    activeSessions: votingSessions.size,
    verifiedSessions: verifiedSessions.size
  });
});

// Reset voting data (protected)
app.post('/api/admin/reset', requireAuth, async (req, res) => {
  try {
    const emptyVotes = { headBoy: {}, headGirl: {}, sportsCaptain: {}, sportsViceCaptain: {} };
    const emptyStudents = [];
    
    const votesSuccess = await writeJsonFile(votesFile, emptyVotes);
    const studentsSuccess = await writeJsonFile(studentsFile, emptyStudents);
    
    // Clear all sessions
    votingSessions.clear();
    verifiedSessions.clear();
    rateLimitMap.clear();
    
    if (votesSuccess && studentsSuccess) {
      res.json({ success: true, message: 'Voting data reset successfully' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to reset voting data' });
    }
  } catch (error) {
    console.error('Error resetting data:', error);
    res.status(500).json({ success: false, message: 'Error resetting voting data' });
  }
});

// Export votes (protected)
app.get('/api/admin/export', requireAuth, async (req, res) => {
  try {
    console.log('Export request received');
    
    const votes = await readJsonFile(votesFile);
    const students = await readJsonFile(studentsFile);
    const candidates = await readJsonFile(candidatesFile);
    
    console.log('Data loaded:', { 
      votesCount: Object.keys(votes).length, 
      studentsCount: students.length, 
      candidatesCount: Object.keys(candidates).length 
    });
    
    // Create a new workbook
    const workbook = XLSX.utils.book_new();
    
    // Sheet 1: Voting Results Summary
    const resultsData = [];
    const positions = ['headBoy', 'headGirl', 'sportsCaptain', 'sportsViceCaptain'];
    
    positions.forEach(position => {
      const positionVotes = votes[position] || {};
      const positionCandidates = candidates[position] || [];
      
      // Sort candidates by vote count (highest first)
      const sortedCandidates = positionCandidates.sort((a, b) => {
        const votesA = positionVotes[a.name] || 0;
        const votesB = positionVotes[b.name] || 0;
        return votesB - votesA;
      });
      
      sortedCandidates.forEach((candidate, index) => {
        const voteCount = positionVotes[candidate.name] || 0;
        const percentage = students.length > 0 ? ((voteCount / students.length) * 100).toFixed(2) : 0;
        const isWinner = index === 0 && voteCount > 0;
        
        resultsData.push({
          'Position': position.charAt(0).toUpperCase() + position.slice(1).replace(/([A-Z])/g, ' $1'),
          'Candidate Name': candidate.name,
          'Votes Received': voteCount,
          'Percentage': percentage + '%',
          'Rank': index + 1,
          'Status': isWinner ? 'WINNER' : voteCount > 0 ? 'Runner-up' : 'No votes'
        });
      });
      
      // Add a blank row between positions
      if (positionCandidates.length > 0) {
        resultsData.push({ 'Position': '', 'Candidate Name': '', 'Votes Received': '', 'Percentage': '', 'Rank': '', 'Status': '' });
      }
    });
    
    const resultsSheet = XLSX.utils.json_to_sheet(resultsData);
    XLSX.utils.book_append_sheet(workbook, resultsSheet, 'Voting Results');
    
    // Sheet 2: Voter Details
    const voterData = students.map(student => ({
      'Voter Name': student.name,
      'Class': student.class,
      'Division': student.division,
      'Voted At': student.votedAt ? new Date(student.votedAt).toLocaleString('en-IN') : 'Not voted',
      'Status': student.votedAt ? 'Voted' : 'Not voted'
    }));
    
    const voterSheet = XLSX.utils.json_to_sheet(voterData);
    XLSX.utils.book_append_sheet(workbook, voterSheet, 'Voter Details');
    
    // Sheet 3: Statistics Summary
    const totalVoters = students.length;
    const totalVoted = students.filter(s => s.votedAt).length;
    const votingPercentage = totalVoters > 0 ? ((totalVoted / totalVoters) * 100).toFixed(2) : 0;
    
    const statsData = [
      { 'Metric': 'Total Registered Voters', 'Value': totalVoters },
      { 'Metric': 'Total Votes Cast', 'Value': totalVoted },
      { 'Metric': 'Voting Percentage', 'Value': votingPercentage + '%' },
      { 'Metric': 'Export Date', 'Value': new Date().toLocaleString('en-IN') }
    ];
    
    const statsSheet = XLSX.utils.json_to_sheet(statsData);
    XLSX.utils.book_append_sheet(workbook, statsSheet, 'Statistics Summary');
    
    console.log('Workbook created with', workbook.SheetNames.length, 'sheets');
    
    // Generate the Excel file
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    console.log('Excel buffer created, size:', excelBuffer.length, 'bytes');
    
    // Set response headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=School-Election-Results-${new Date().toISOString().split('T')[0]}.xlsx`);
    res.setHeader('Content-Length', excelBuffer.length);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    
    console.log('Headers set, sending response');
    res.send(excelBuffer);
    
  } catch (error) {
    console.error('Error exporting data:', error);
    // Don't send JSON error response, send a simple error message
    res.status(500).setHeader('Content-Type', 'text/plain');
    res.send('Error exporting data: ' + error.message);
  }
});

// Debug endpoint to check system status (remove in production)
app.get('/api/debug/status', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    activeSessions: votingSessions.size,
    verifiedSessions: verifiedSessions.size,
    rateLimitEntries: rateLimitMap.size,
    message: 'System is running'
  });
});

// Cleanup expired sessions periodically
setInterval(() => {
  const now = Date.now();
  const sessionTimeout = 10 * 60 * 1000; // 10 minutes
  
  // Clean up expired verification sessions
  for (const [token, session] of verifiedSessions.entries()) {
    if (now - session.timestamp > sessionTimeout) {
      verifiedSessions.delete(token);
    }
  }
  
  // Clean up stuck voting sessions
  for (const [voterKey, session] of votingSessions.entries()) {
    if (now - session.timestamp > sessionTimeout) {
      votingSessions.delete(voterKey);
    }
  }
  
  // Clean up rate limit data
  for (const [ip, data] of rateLimitMap.entries()) {
    if (now > data.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000); // Run every 5 minutes

// POST /api/candidates/:position/:id/symbol
app.post('/api/candidates/:position/:id/symbol', requireAuth, symbolUpload.single('symbol'), async (req, res) => {
  try {
    const { position, id } = req.params;
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    const candidates = await readJsonFile(candidatesFile);
    if (!candidates[position]) {
      return res.status(400).json({ success: false, message: 'Invalid position' });
    }
    
    const candidateIndex = candidates[position].findIndex(c => c.id == id);
    if (candidateIndex === -1) {
      return res.status(404).json({ success: false, message: 'Candidate not found' });
    }
    
    // Convert file to base64
    const fileBuffer = await fs.readFile(req.file.path);
    const base64String = `data:${req.file.mimetype};base64,${fileBuffer.toString('base64')}`;
    
    // Save base64 data instead of file path
    candidates[position][candidateIndex].symbol = base64String;
    
    // Clean up the temporary file
    await fs.unlink(req.file.path);
    
    const success = await writeJsonFile(candidatesFile, candidates);
    if (success) {
      res.json({ success: true, symbol: candidates[position][candidateIndex].symbol });
    } else {
      res.status(500).json({ success: false, message: 'Failed to save symbol' });
    }
  } catch (error) {
    console.error('Error uploading symbol:', error);
    res.status(500).json({ success: false, message: 'Error uploading symbol' });
  }
});

const symbolMultiUpload = multer({ dest: 'uploads/' });

app.post('/api/upload-symbols', requireAuth, symbolMultiUpload.array('symbols', 50), async (req, res) => {
  try {
    const candidates = await readJsonFile(candidatesFile);
    const files = req.files; // array of files

    // Flatten all candidates into one array for easy matching
    const allCandidates = [
      ...candidates.headBoy,
      ...candidates.headGirl,
      ...candidates.sportsCaptain,
      ...candidates.sportsViceCaptain
    ];

    for (const file of files) {
      const match = allCandidates.find(
        c => c.symbolFile && c.symbolFile.trim().toLowerCase() === file.originalname.trim().toLowerCase()
      );
      if (match) {
        // Optionally rename the file to its original name for clarity
        await fs.rename(`uploads/${file.filename}`, `uploads/${file.originalname}`);
        match.symbol = `/uploads/${file.originalname}`;
      }
    }

    await writeJsonFile(candidatesFile, candidates);
    res.json({ success: true, message: 'Symbols uploaded and matched.' });
  } catch (error) {
    console.error('Error uploading symbols:', error);
    res.status(500).json({ success: false, message: 'Error uploading symbols.' });
  }
});

// Initialize and start server
initializeData().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Security features enabled:');
    console.log('- Session-based voting prevention');
    console.log('- Input validation and sanitization');
    console.log('- Rate limiting (20 requests/minute)');
    console.log('- Duplicate vote detection');
    console.log('- Debug endpoint: /api/debug/status');
    console.log('- Support for 4 positions: Head Boy, Head Girl, Sports Captain, Sports Vice Captain');
  });
});