// StreamFlix Backend Server
// Node.js Express server for serving media from local directory

const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const app = express();

// Configuration
const PORT = process.env.PORT || 3000;
let MEDIA_PATH = process.env.MEDIA_PATH || '/path/to/media';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// API Routes

// Get media library
app.get('/api/media', async (req, res) => {
    try {
        const media = await scanMediaDirectory(MEDIA_PATH);
        res.json(media);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Stream video
app.get('/api/stream/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(MEDIA_PATH, filename);
    
    fs.stat(filePath, (err, stats) => {
        if (err) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        const range = req.headers.range;
        if (!range) {
            return res.status(416).send('Range header required');
        }
        
        const positions = range.replace(/bytes=/, "").split("-");
        const start = parseInt(positions[0], 10);
        const fileSize = stats.size;
        const end = positions[1] ? parseInt(positions[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        
        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'video/mp4'
        });
        
        const stream = require('fs').createReadStream(filePath, { start, end });
        stream.pipe(res);
    });
});

// Update media path
app.post('/api/config/media-path', (req, res) => {
    const { path: newPath } = req.body;
    MEDIA_PATH = newPath;
    res.json({ success: true, path: MEDIA_PATH });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', mediaPath: MEDIA_PATH });
});

// Helper function to scan media directory
async function scanMediaDirectory(dirPath) {
    const media = {
        movies: [],
        series: [],
        documentaries: []
    };
    
    try {
        const files = await fs.readdir(dirPath);
        
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stats = await fs.stat(filePath);
            
            if (stats.isFile() && isVideoFile(file)) {
                const mediaItem = {
                    title: path.parse(file).name,
                    filename: file,
                    size: stats.size,
                    type: determineMediaType(file)
                };
                
                if (mediaItem.type === 'movie') {
                    media.movies.push(mediaItem);
                } else if (mediaItem.type === 'series') {
                    media.series.push(mediaItem);
                } else {
                    media.documentaries.push(mediaItem);
                }
            }
        }
    } catch (error) {
        console.error('Error scanning media directory:', error);
    }
    
    return media;
}

function isVideoFile(filename) {
    const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm'];
    return videoExtensions.some(ext => filename.toLowerCase().endsWith(ext));
}

function determineMediaType(filename) {
    const lower = filename.toLowerCase();
    if (lower.includes('s0') || lower.includes('episode') || lower.includes('e0')) {
        return 'series';
    }
    if (lower.includes('documentary') || lower.includes('doc')) {
        return 'documentary';
    }
    return 'movie';
}

// Start server
app.listen(PORT, () => {
    console.log(`StreamFlix server running on port ${PORT}`);
    console.log(`Media path: ${MEDIA_PATH}`);
});
