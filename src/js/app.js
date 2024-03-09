const CLIENT_ID = 'f5261a72ae4d4dab8a746aeec4dd3b4b';
const AUTH_SCOPE = 'user-modify-playback-state user-read-playback-state user-read-private user-read-email user-read-playback-state user-top-read';

var songTitle, artist, albumCover, progressText, durationText, progressBar, statusMsg, topTrackOrder, topArtistOrder;
var topArtists = [], topTracks = [];

function setStatus(s) {
    // FIXME: good luck lmao
    if (s.success == true && s.message) {
        statusMsg.innerText = s.message;
    } else {
        statusMsg.innerText = s;
    }

    setTimeout(statusMsg.innerText = "", 2000);
}


async function auth() {
    console.debug("Preparing to authenticate with PCKE security");
    const generateRandomString = (length) => {
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const values = crypto.getRandomValues(new Uint8Array(length));
        return values.reduce((acc, x) => acc + possible[x % possible.length], "");
    }

    const codeVerifier = generateRandomString(64);

    const sha256 = async (plain) => {
        const encoder = new TextEncoder()
        const data = encoder.encode(plain)
        return window.crypto.subtle.digest('SHA-256', data)
    }

    const base64encode = (input) => {
        return btoa(String.fromCharCode(...new Uint8Array(input)))
            .replace(/=/g, '')
            .replace(/\+/g, '-')
            .replace(/\//g, '_');
    }

    const hashed = await sha256(codeVerifier)
    const codeChallenge = base64encode(hashed);

    const authUrl = new URL("https://accounts.spotify.com/authorize")

    window.localStorage.setItem('code_verifier', codeVerifier);

    authUrl.search = new URLSearchParams({
        response_type: 'code',
        client_id: CLIENT_ID,
        scope: AUTH_SCOPE,
        code_challenge_method: 'S256',
        code_challenge: codeChallenge,
        redirect_uri: 'http://localhost:3000',
    }).toString();

    window.location.href = authUrl.toString();
}

function getToken(code) {
    console.debug("Fetching token");
    let codeVerifier = localStorage.getItem('code_verifier');

    fetch("https://accounts.spotify.com/api/token", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            client_id: CLIENT_ID,
            grant_type: 'authorization_code',
            code,
            redirect_uri: "http://localhost:3000",
            code_verifier: codeVerifier,
        }),
    })
        .then(response => response.json())
        .then(json => {
            if (json.access_token !== undefined) {
                localStorage.setItem('access_token', json.access_token);
                localStorage.setItem('token_type', json.token_type);
                localStorage.setItem('refresh_token', json.refresh_token);
            }
        })
        .catch(e => {
            console.error("Failed to get token:", e)
        });
}

function getRefreshToken(refreshToken) {
    console.debug("Fetching refresh token");

    fetch("https://accounts.spotify.com/api/token", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            client_id: CLIENT_ID,
            grant_type: 'refresh_token',
            refresh_token: refreshToken
        }),
    })
        .then(response => response.json())
        .then(json => {
            if (json.access_token !== undefined) {
                localStorage.setItem('access_token', json.access_token);
                localStorage.setItem('token_type', json.token_type);
                localStorage.setItem('refresh_token', json.refresh_token);
            }
        })
        .catch(e => console.error("Failed to get refresh token:", e));
}

function pause() {
    fetch("https://api.spotify.com/v1/me/player/pause", {
        "method": "PUT",
        "headers": authHeader
    })
        .then(response => {
            if (response.status == 204) return {
                success: true,
                "message": "Playback paused"
            };
        })
        .catch(e => JSON.stringify(e));
    loadPlayerData();
}

function play() {
    fetch("https://api.spotify.com/v1/me/player/play", {
        "method": "PUT",
        "headers": authHeader
    })
        .then(response => {
            if (response.status == 204) return {
                success: true,
                "message": "Playback started or resumed"
            };
            return response.json();
        })
        .catch(e => setStatus(e));
    loadPlayerData();
}

function skipPrevious() {
    fetch("https://api.spotify.com/v1/me/player/previous", {
        "method": "POST",
        "headers": authHeader
    })
        .then(response => {
            if (response.status == 204) return {
                success: true,
                "message": "Command sent"
            };
            return response.json();
        })
        .catch(e => setStatus(e));
    loadPlayerData();
}

function skipNext() {
    fetch("https://api.spotify.com/v1/me/player/next", {
        "method": "POST",
        "headers": authHeader
    })
        .then(response => {
            if (response.status == 204) return {
                success: true,
                "message": "Command sent"
            };
            return response.json();
        })
        .catch(e => setStatus(e));
    loadPlayerData();
}

function loadUserData() {
    const uid = document.getElementById('uid');
    const ulm = document.getElementById('ulm');
    const pfp = document.getElementById('pfp');

    if (accessToken === "undefined") return;

    console.debug("Sending request to /me to get user details")
    fetch("https://api.spotify.com/v1/me", {
        "method": "GET",
        "headers": authHeader
    })
        .then(response => response.json())
        .then(json => {
            if (json.error) {
                uid.innerText = "Log In"
                console.error("API Error at /me:", json.error)
            } else {
                uid.innerText = `Logged in as ${json.display_name}`
                ulm.innerText = json.email
                pfp.src = json.images[0].url;
            }
        })
        .catch(e => uid.innerText = `Failed to authenticate:\n${e}`);
}

function formatMillis(ms) {
    let totalSeconds = Math.floor(ms / 1000);
    let minutes = Math.floor(totalSeconds / 60);
    let seconds = totalSeconds % 60;
    let formattedTime = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    return formattedTime;
}

function setPlaybackState(isPlaying) {
    const playButton = document.getElementById("btn-play");
    const pauseButton = document.getElementById("btn-pause");

    playButton.classList.toggle("force-hidden", isPlaying);
    pauseButton.classList.toggle("force-hidden", !isPlaying);

    albumCover.classList.toggle("scale-90", !isPlaying);
}

let bpmAnimInterval;
let animOnHalfBeat = false;
let lastSongId = -1;

function toggleAnimOnHalfBeat() {
    console.debug("Setting animOnHalfBeat to " + !animOnHalfBeat)
    setStatus(!animOnHalfBeat ? "Pulsing on half-beats" : "Pulsing on beats")
    animOnHalfBeat = !animOnHalfBeat;
    initBpmAnimation(lastSongId);
}

function initBpmAnimation(trackId) {
    console.log("Initializing BPM animation for track " + trackId);
    fetch("https://api.spotify.com/v1/audio-features/" + trackId, {
        "method": "GET",
        "headers": authHeader
    })
        .then(response => response.json())
        .then(json => {
            clearInterval(bpmAnimInterval);

            bpmAnimInterval = setInterval(function() {
                albumCover.classList.add("scale-105");
                setTimeout(function() {
                    albumCover.classList.remove("scale-105");
                }, 200)
            }, 60000 / json.tempo * (animOnHalfBeat ? 1 : 2));
        })
        .catch(e => setStatus(e));
}

function setPlayerData(trackName, artistName, albumCoverUrl, progressMs, durationMs) {
    songTitle.innerText = trackName;
    topTrackOrder.innerText = `#${topTracks.indexOf(trackName) + 1}`
    if (topTrackOrder.innerText == "#0") topTrackOrder.innerText = "";
    songTitle.classList.toggle("text-gold", topTracks.includes(trackName));

    artist.innerText = artistName;
    topArtistOrder.innerText = `#${topArtists.indexOf(artistName) + 1}`
    if (topArtistOrder.innerText == "#0") topArtistOrder.innerText = "";
    artist.classList.toggle("text-darker-gold", topArtists.includes(artistName));

    albumCover.src = albumCoverUrl;

    progressText.innerText = formatMillis(progressMs);
    durationText.innerText = formatMillis(durationMs);
    progressBar.style = `width: ${progressMs / durationMs * 100}%`;
}
function loadPlayerData() {
    console.debug("Fetching and loading player data");

    fetch("https://api.spotify.com/v1/me/player", {
        "method": "GET",
        "headers": authHeader
    })
        .then(response => {
            if (response.status == 204) return {
                success: true,
                "message": "Playback not avaliable or active"
            };
            return response.json();
        })
        .then(json => {
            if (json.item == null) {
                setPlayerData("Not Playing", "", "resources/transparent.png", 0, 1);
                setPlaybackState(false);
            } else {
                setPlayerData(json.item.name, json.item.artists[0].name, json.item.album.images[0].url, json.progress_ms, json.item.duration_ms);
                setPlaybackState(json.is_playing);

                if (lastSongId != json.item.id) initBpmAnimation(json.item.id);
                lastSongId = json.item.id;
            }
        })
        .catch(e => {
            setStatus(e);
            console.error("Error while loading player data:", e);
        });
}

function storeTopItems() {
    console.debug("Fetching and storing user's top artists and tracks")

    fetch("https://api.spotify.com/v1/me/top/artists", {
        "method": "GET",
        "headers": authHeader
    })
        .then(response => response.json())
        .then(json => topArtists = json.items.map(artist => artist.name))
        .catch(e => {
            setStatus(e);
            console.error("Error while fetching user's top artists:", e);
        });

    fetch("https://api.spotify.com/v1/me/top/tracks", {
        "method": "GET",
        "headers": authHeader
    })
        .then(response => response.json())
        .then(json => topTracks = json.items.map(track => track.name))
        .catch(e => {
            setStatus(e);
            console.error("Error while fetching user's top tracks:", e);
        });
}

addEventListener("DOMContentLoaded", function () {
    statusMsg = document.getElementById("status");
    songTitle = document.getElementById("song-title");
    artist = document.getElementById("artist");
    albumCover = document.getElementById("album-cover");
    progressText = document.getElementById("song-progress");
    durationText = document.getElementById("song-duration");
    progressBar = document.getElementById("progress-bar");
    topTrackOrder = document.getElementById("top-track-order");
    topArtistOrder = document.getElementById("top-artist-order");

    loadUserData();

    loadPlayerData();
    setInterval(loadPlayerData, 1000);

    storeTopItems();
})

const code = new URLSearchParams(window.location.search).get('code');
getToken(code);
let accessToken = localStorage.getItem('access_token');
let refreshToken = localStorage.getItem('refresh_token');
if (refreshToken !== undefined) getRefreshToken(refreshToken);

const authHeader = {
    "Authorization": localStorage.getItem('token_type') + ' ' + accessToken
}
