import express from 'express';
import cors from 'cors';
import multer from 'multer';
import XLSX from 'xlsx';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT;
console.log(PORT);

// Middleware
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'https://school-voting-system.vercel.app',
  'https://vote-system-phi.vercel.app'
];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
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

// Data file paths
const dataDir = join(__dirname, 'data');
const studentsFile = join(dataDir, 'students.json');
const votesFile = join(dataDir, 'votes.json');
const candidatesFile = join(dataDir, 'candidates.json');
const settingsFile = join(dataDir, 'settings.json');
const adminsFile = join(dataDir, 'admins.json');

// Initialize data files
async function initializeData() {
  try {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.mkdir('uploads', { recursive: true });

    // Initialize files if they don't exist
    const files = [
      { path: studentsFile, data: [] },
      { path: votesFile, data: { headBoy: {}, headGirl: {} } },
      { path: candidatesFile, data: { headBoy: [], headGirl: [] } },
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
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication required' 
    });
  }

  const token = authHeader.split(' ')[1];
  
  if (!token || !token.startsWith('admin_')) {
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid token' 
    });
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
app.post('/api/upload-candidates', requireAuth, upload.single('excel'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const workbook = XLSX.readFile(req.file.path);
    const sheetName = 'Candidates';
    
    if (!workbook.SheetNames.includes(sheetName)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Excel file must contain a sheet named "Candidates"' 
      });
    }

    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    const candidates = { headBoy: [], headGirl: [] };

    data.forEach(row => {
      if (row.name && row.gender) {
        const candidate = {
          id: Date.now() + Math.random(),
          name: row.name.toString().trim(),
          gender: row.gender.toString().toLowerCase().trim()
        };

        if (candidate.gender === 'male') {
          candidates.headBoy.push(candidate);
        } else if (candidate.gender === 'female') {
          candidates.headGirl.push(candidate);
        }
      }
    });

    const success = await writeJsonFile(candidatesFile, candidates);
    
    if (success) {
      res.json({ success: true, candidates });
    } else {
      res.status(500).json({ success: false, message: 'Failed to save candidates' });
    }

    // Clean up uploaded file
    await fs.unlink(req.file.path);
  } catch (error) {
    console.error('Error processing Excel file:', error);
    res.status(500).json({ success: false, message: 'Error processing Excel file' });
  }
});

// Check if student has voted
app.post('/api/check-voter', async (req, res) => {
  const { name, class: studentClass, division, dateOfBirth } = req.body;
  
  const students = await readJsonFile(studentsFile);
  const voterKey = `${name.toLowerCase()}_${studentClass}_${division}_${dateOfBirth}`;
  
  const hasVoted = students.some(student => student.voterKey === voterKey);
  
  res.json({ hasVoted, voterKey });
});

// Submit vote
app.post('/api/vote', async (req, res) => {
  try {
    const { voterKey, headBoyVote, headGirlVote, voterInfo } = req.body;
    
    // Check if voting is enabled
    const settings = await readJsonFile(settingsFile);
    if (!settings.votingEnabled) {
      return res.status(400).json({ success: false, message: 'Voting is currently disabled' });
    }

    // Check if student has already voted
    const students = await readJsonFile(studentsFile);
    const hasVoted = students.some(student => student.voterKey === voterKey);
    
    if (hasVoted) {
      return res.status(400).json({ success: false, message: 'You have already voted' });
    }

    // Record the vote
    const votes = await readJsonFile(votesFile);
    
    if (headBoyVote) {
      votes.headBoy[headBoyVote] = (votes.headBoy[headBoyVote] || 0) + 1;
    }
    
    if (headGirlVote) {
      votes.headGirl[headGirlVote] = (votes.headGirl[headGirlVote] || 0) + 1;
    }

    // Add student to voted list
    students.push({
      voterKey,
      ...voterInfo,
      votedAt: new Date().toISOString(),
      headBoyVote: headBoyVote || null,
      headGirlVote: headGirlVote || null
    });

    // Save both files
    const votesSuccess = await writeJsonFile(votesFile, votes);
    const studentsSuccess = await writeJsonFile(studentsFile, students);

    if (votesSuccess && studentsSuccess) {
      res.json({ success: true, message: 'Vote recorded successfully' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to record vote' });
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
    candidates
  });
});

// Reset voting data (protected)
app.post('/api/admin/reset', requireAuth, async (req, res) => {
  try {
    const emptyVotes = { headBoy: {}, headGirl: {} };
    const emptyStudents = [];
    
    const votesSuccess = await writeJsonFile(votesFile, emptyVotes);
    const studentsSuccess = await writeJsonFile(studentsFile, emptyStudents);
    
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
    const votes = await readJsonFile(votesFile);
    const students = await readJsonFile(studentsFile);
    const candidates = await readJsonFile(candidatesFile);
    
    const exportData = {
      exportDate: new Date().toISOString(),
      totalVoters: students.length,
      votes,
      candidates,
      votersList: students.map(student => ({
        name: student.name,
        class: student.class,
        division: student.division,
        votedAt: student.votedAt
      }))
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=voting-results.json');
    res.json(exportData);
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({ success: false, message: 'Error exporting data' });
  }
});

// Delete candidate (protected)
app.delete('/api/candidates/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Attempting to delete candidate with ID:', id);
    
    const candidates = await readJsonFile(candidatesFile);
    console.log('Current candidates:', candidates);
    
    if (!candidates) {
      return res.status(500).json({ success: false, message: 'Failed to load candidates' });
    }

    // Convert id to string for comparison since it might be coming as a number
    const candidateId = String(id);

    // Remove candidate from both headBoy and headGirl arrays
    const originalHeadBoyLength = candidates.headBoy.length;
    const originalHeadGirlLength = candidates.headGirl.length;

    candidates.headBoy = candidates.headBoy.filter(c => String(c.id) !== candidateId);
    candidates.headGirl = candidates.headGirl.filter(c => String(c.id) !== candidateId);

    console.log('After deletion - Head Boy:', candidates.headBoy.length, 'Head Girl:', candidates.headGirl.length);

    // Check if any candidates were actually removed
    if (candidates.headBoy.length === originalHeadBoyLength && 
        candidates.headGirl.length === originalHeadGirlLength) {
      return res.status(404).json({ 
        success: false, 
        message: 'Candidate not found' 
      });
    }

    const success = await writeJsonFile(candidatesFile, candidates);
    
    if (success) {
      res.json({ 
        success: true, 
        candidates,
        message: 'Candidate deleted successfully'
      });
    } else {
      res.status(500).json({ success: false, message: 'Failed to delete candidate' });
    }
  } catch (error) {
    console.error('Error deleting candidate:', error);
    res.status(500).json({ success: false, message: 'Error deleting candidate' });
  }
});

// Add this before the app.listen call
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    success: false, 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Add a catch-all route for undefined routes
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Route not found' 
  });
});

// Initialize and start server
initializeData().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});