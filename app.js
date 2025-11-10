// StreamFlix Frontend
let SERVER_URL = '';

const serverModal = document.getElementById('serverModal');
const serverBtn = document.getElementById('serverBtn');
const serverForm = document.getElementById('serverForm');
const closeBtns = document.querySelectorAll('.close');
const playerModal = document.getElementById('playerModal');
const videoPlayer = document.getElementById('videoPlayer');
const navbar = document.querySelector('.navbar');

serverBtn.addEventListener('click', () => {
    serverModal.classList.add('active');
    serverModal.style.display = 'flex';
});

closeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        serverModal.style.display = 'none';
        playerModal.style.display = 'none';
        videoPlayer.pause();
    });
});

serverForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const serverUrl = document.getElementById('serverUrl').value;
    const status = document.getElementById('connectionStatus');
    status.textContent = 'Connecting...';
    try {
        const res = await fetch(`${serverUrl}/api/health`);
        if (res.ok) {
            SERVER_URL = serverUrl;
            status.textContent = 'Connected!';
            status.classList.add('success');
            await loadMedia();
            setTimeout(() => serverModal.style.display = 'none', 1500);
        }
    } catch (err) {
        status.textContent = 'Failed to connect';
        status.classList.add('error');
    }
});

async function loadMedia() {
    const res = await fetch(`${SERVER_URL}/api/media`);
    const data = await res.json();
    displayMedia(data.movies, 'movie-posters');
    displayMedia(data.series, 'series-posters');
    displayMedia(data.documentaries, 'doc-posters');
}

function displayMedia(items, id) {
    const container = document.getElementById(id);
    container.innerHTML = '';
    items.forEach(item => {
        const poster = document.createElement('div');
        poster.className = 'poster';
        poster.innerHTML = `<div class="poster-info"><div class="poster-title">${item.title}</div></div>`;
        poster.onclick = () => playVideo(item);
        container.appendChild(poster);
    });
}

function playVideo(item) {
    videoPlayer.src = `${SERVER_URL}/api/stream/${encodeURIComponent(item.filename)}`;
    document.getElementById('playerTitle').textContent = item.title;
    playerModal.style.display = 'flex';
    videoPlayer.play();
}

window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 100);
});
