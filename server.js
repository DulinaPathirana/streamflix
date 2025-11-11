// StreamFlix Backend Server with TMDB Metadata
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const { MovieDb } = require('moviedb-promise');
const app = express();

// Configuration
const PORT = process.env.PORT || 3000;
let MEDIA_PATH = process.env.MEDIA_PATH || '/path/to/media';
const TMDB_API_KEY = process.env.TMDB_API_KEY || '15d2ea6d0dc1d476efbca3eba2b9bbfb';
const moviedb = new MovieDb(TMDB_API_KEY);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Cache for metadata to avoid repeated API calls
const metadataCache = new Map();

// API Routes
app.get('/api/media', async (req, res) => {
    try {
        console.log('Scanning media from:', MEDIA_PATH);
        const media = await scanMediaDirectory(MEDIA_PATH);
        console.log(`Found ${media.length} media files`);
        res.json(media);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Stream video
app.get('/api/stream/:filename', (req, res) => {
    const filename = decodeURIComponent(req.params.filename);
    const filePath = path.isAbsolute(filename) ? filename : path.join(MEDIA_PATH, filename);
    
    require('fs').stat(filePath, (err, stats) => {
        if (err) {
            console.error('File not found:', filePath);
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

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', mediaPath: MEDIA_PATH });
});

// Recursive media directory scanner
async function scanMediaDirectory(dirPath) {
    const mediaFiles = [];
    
    async function scanRecursive(currentPath) {
        try {
            const entries = await fs.readdir(currentPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(currentPath, entry.name);
                
                if (entry.isDirectory()) {
                    // Skip hidden folders and system folders
                    if (!entry.name.startsWith('.') && !entry.name.startsWith('@')) {
                        await scanRecursive(fullPath);
                    }
                } else if (entry.isFile() && isVideoFile(entry.name)) {
                    const relativePath = path.relative(dirPath, fullPath);
                    const folderName = path.basename(path.dirname(fullPath));
                    
                    // Get metadata from TMDB
                    const metadata = await getMediaMetadata(entry.name, folderName);
                    
                    mediaFiles.push({
                        title: metadata.title || cleanTitle(entry.name),
                        path: relativePath,
                        category: metadata.category || determineMediaType(entry.name),
                        poster: metadata.poster || '',
                        backdrop: metadata.backdrop || '',
                        overview: metadata.overview || '',
                        year: metadata.year || '',
                        rating: metadata.rating || 0
                    });
                }
            }
        } catch (error) {
            console.error(`Error scanning ${currentPath}:`, error.message);
        }
    }
    
    await scanRecursive(dirPath);
    return mediaFiles;
}

// Get metadata from TMDB
async function getMediaMetadata(filename, folderName) {
    const searchTerm = folderName && folderName !== 'Movies' && folderName !== 'TV Shows' 
        ? folderName 
        : cleanTitle(filename);
    
    // Check cache first
    if (metadataCache.has(searchTerm)) {
        return metadataCache.get(searchTerm);
    }
    
    try {
        // Try movie search first
        const movieResults = await moviedb.searchMovie({ query: searchTerm });
        
        if (movieResults.results && movieResults.results.length > 0) {
            const movie = movieResults.results[0];
            const metadata = {
                title: movie.title,
                category: 'movie',
                poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : '',
                backdrop: movie.backdrop_path ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}` : '',
                overview: movie.overview || '',
                year: movie.release_date ? movie.release_date.split('-')[0] : '',
                rating: movie.vote_average || 0
            };
            
            metadataCache.set(searchTerm, metadata);
            return metadata;
        }
        
        // Try TV show search
        const tvResults = await moviedb.searchTv({ query: searchTerm });
        
        if (tvResults.results && tvResults.results.length > 0) {
            const show = tvResults.results[0];
            const metadata = {
                title: show.name,
                category: 'series',
                poster: show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : '',
                backdrop: show.backdrop_path ? `https://image.tmdb.org/t/p/original${show.backdrop_path}` : '',
                overview: show.overview || '',
                year: show.first_air_date ? show.first_air_date.split('-')[0] : '',
                rating: show.vote_average || 0
            };
            
            metadataCache.set(searchTerm, metadata);
            return metadata;
        }
    } catch (error) {
        console.log(`Could not fetch metadata for: ${searchTerm}`);
    }
    
    // Return basic info if TMDB lookup fails
    return {
        title: searchTerm,
        category: determineMediaType(filename),
        poster: '',
        backdrop: '',
        overview: '',
        year: '',
        rating: 0
    };
}

// Clean title from filename
function cleanTitle(filename) {
    return path.parse(filename).name
        .replace(/[.\-_]/g, ' ')
        .replace(/\b(\d{4})\b.*$/g, '')
        .replace(/\b(720p|1080p|2160p|4k|bluray|webrip|hdtv|x264|x265)\b/gi, '')
        .trim();
}

function isVideoFile(filename) {
    const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v'];
    return videoExtensions.some(ext => filename.toLowerCase().endsWith(ext));
}

function determineMediaType(filename) {
    const lower = filename.toLowerCase();
    if (lower.match(/s\d{2}e\d{2}/i) || lower.includes('episode')) {
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
    console.log(`TMDB integration: ${TMDB_API_KEY ? 'Enabled' : 'Disabled'}`);
});
