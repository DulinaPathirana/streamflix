// StreamFlix Frontend - Auto-connect to NAS
const SERVER_URL = 'http://192.168.1.49:3000';

const playerModal = document.getElementById('playerModal');
const videoPlayer = document.getElementById('videoPlayer');
const navbar = document.querySelector('.navbar');

// Close player modal
const closeBtns = document.querySelectorAll('.close');
closeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        playerModal.style.display = 'none';
        videoPlayer.pause();
    });
});

// Navbar scroll effect
window.addEventListener('scroll', () => {
    if (window.scrollY > 100) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// Load media on page load
async function loadMedia() {
    try {
        const res = await fetch(`${SERVER_URL}/api/media`);
        const data = await res.json();
        displayMedia(data);
    } catch (err) {
        console.error('Failed to load media:', err);
        document.getElementById('moviesRow').innerHTML = `<p style="color: white; padding: 20px;">Failed to connect to media server. Please ensure server is running at ${SERVER_URL}</p>`;
    }
}

function displayMedia(mediaData) {
    const moviesRow = document.getElementById('moviesRow');
    const seriesRow = document.getElementById('seriesRow');
    const docsRow = document.getElementById('docsRow');

    moviesRow.innerHTML = '';
    seriesRow.innerHTML = '';
    docsRow.innerHTML = '';

    mediaData.forEach(item => {
        const card = document.createElement('div');
        card.className = 'media-card';
        card.innerHTML = ``
            <div class="media-poster" style="background-image: url('${item.poster || 'https://via.placeholder.com/300x450?text=No+Poster'}');">
                <div class="play-btn">▶</div>
                ${item.rating ? `<div class="rating">⭐ ${item.rating.toFixed(1)}</div>` : ''}
            </div>
            <div class="media-title">${item.title}</div>
            ${item.year ? `<div class="media-year">${item.year}</div>` : ''}
        `;

        card.onclick = () => playVideo(item);

        if (item.category === 'movie') {
            moviesRow.appendChild(card);
        } else if (item.category === 'series') {
            seriesRow.appendChild(card);
        } else if (item.category === 'documentary') {
            docsRow.appendChild(card);
        }
    });
}

function playVideo(item) {
    const videoUrl = `${SERVER_URL}/api/stream/${encodeURIComponent(item.path)}`;
    videoPlayer.src = videoUrl;
    playerModal.style.display = 'flex';
    videoPlayer.play();
}

// Auto-load media on page load
window.addEventListener('DOMContentLoaded', loadMedia);
