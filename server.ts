import express from 'express';
import { createServer as createViteServer } from 'vite';
import { google } from 'googleapis';
import multer from 'multer';
import dotenv from 'dotenv';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
const PORT = 3000;
const upload = multer({ storage: multer.memoryStorage() });

// Store tokens in memory for prototype
let globalTokens: any = null;

const getOAuth2Client = () => {
  const redirectUri = `${process.env.APP_URL || 'http://localhost:3000'}/auth/callback`;
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
};

// API routes FIRST
app.get('/api/auth/url', (req, res) => {
  try {
    const oauth2Client = getOAuth2Client();
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/drive.file'],
      prompt: 'consent'
    });
    res.json({ url: authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
});

app.get(['/auth/callback', '/auth/callback/'], async (req, res) => {
  const { code } = req.query;
  if (!code || typeof code !== 'string') {
    return res.status(400).send('Missing code');
  }

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    globalTokens = tokens; // Store in memory

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error exchanging code:', error);
    res.status(500).send('Authentication failed');
  }
});

app.get('/api/auth/status', (req, res) => {
  res.json({ isAuthenticated: !!globalTokens });
});

app.post('/api/upload-to-drive', upload.single('file'), async (req, res) => {
  if (!globalTokens) {
    return res.status(401).json({ error: 'Not authenticated with Google' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials(globalTokens);

    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Convert buffer to stream
    const bufferStream = new Readable();
    bufferStream.push(req.file.buffer);
    bufferStream.push(null);

    const folderId = '1gMMZxciTndl-ZYK6eppUZO5YhnQsa0lQ';
    const fileName = req.body.fileName || req.file.originalname || 'KHBD_NLS.docx';

    const fileMetadata = {
      name: fileName,
      parents: [folderId]
    };

    const media = {
      mimeType: req.file.mimetype,
      body: bufferStream
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink'
    });

    res.json({ 
      success: true, 
      fileId: response.data.id,
      webViewLink: response.data.webViewLink
    });
  } catch (error) {
    console.error('Error uploading to Drive:', error);
    res.status(500).json({ error: 'Failed to upload to Google Drive' });
  }
});

// Endpoint to save file locally
app.post('/api/save-local', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const uploadDir = path.join(process.cwd(), 'File_KHBD_Upload');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const originalFileName = req.body.fileName || req.file.originalname || 'KHBD_NLS.docx';
    const parsedPath = path.parse(originalFileName);
    
    // Extract grade from filename (6, 7, 8, or 9)
    let grade = 'THCS';
    const gradeMatch = originalFileName.match(/(?:lớp|lop)\s*([6-9])|(?:tin\s*học|tin)\s*([6-9])|(?:^|[^0-9])([6-9])(?:[^0-9]|$)/i);
    if (gradeMatch) {
      grade = gradeMatch[1] || gradeMatch[2] || gradeMatch[3];
    }
    
    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    
    const timestamp = `${day}${month}${year}_${hours}_${minutes}`;
    const fileName = `KHBD_TinHoc_${grade}_${timestamp}${parsedPath.ext}`;
    const filePath = path.join(uploadDir, fileName);

    fs.writeFileSync(filePath, req.file.buffer);

    res.json({ 
      success: true, 
      filePath: filePath
    });
  } catch (error) {
    console.error('Error saving file locally:', error);
    res.status(500).json({ error: 'Failed to save file locally' });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
