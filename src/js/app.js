const CLIENT_ID = 'f5261a72ae4d4dab8a746aeec4dd3b4b';
const AUTH_SCOPE = 'user-modify-playback-state user-read-playback-state user-read-private user-read-email user-read-playback-state';

var statusMsg = null;

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
            return response.json();
        })
        .then(json => statusMsg.innerText = JSON.stringify(json))
        .catch(e => statusMsg.innerText = e);
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
        .then(json => statusMsg.innerText = JSON.stringify(json))
        .catch(e => statusMsg.innerText = e);
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
        .then(json => statusMsg.innerText = JSON.stringify(json))
        .catch(e => statusMsg.innerText = e);
}

function loadUserData() {
    const uid = document.getElementById('uid');
    const ulm = document.getElementById('ulm');

    if (accessToken === "undefined") return;

    console.debug("Sending request to /me to get user details")
    fetch("https://api.spotify.com/v1/me", {
        "method": "GET",
        "headers": authHeader
    })
        .then(response => response.json())
        .then(json => {
            if (json.error) {
                uid.innerText = `API Error ${json.error.status}`
                ulm.innerText = json.error.message
                console.error("API Error at /me:", json.error)
            } else {
                uid.innerText = `Logged in as ${json.display_name}`
                ulm.innerText = json.email
            }
        })
        .catch(e => uid.innerText = `Failed to authenticate:\n${e}`);
}

function loadPlayerData() {
    console.debug("Fetching and loading player data");

    const songTitle = document.getElementById("song-title");
    const artist = document.getElementById("artist");
    const album = document.getElementById("album");
    const albumCover = document.getElementById("album-cover");

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
                songTitle.innerText = "Not Playing"
            } else {
                songTitle.innerText = json.item.name;
                artist.innerText = json.item.artists[0].name;
                album.innerText = json.item.album.name;
                albumCover.src = json.item.album.images[0].url;
            }
        })
        .catch(e => {
            statusMsg.innerText = e;
            console.error("Error while loading player data:", e);
        });
}

addEventListener("DOMContentLoaded", function () {
    statusMsg = document.getElementById("status");
    loadUserData();

    loadPlayerData();
    setInterval(loadPlayerData, 1000);
})

const code = new URLSearchParams(window.location.search).get('code');
getToken(code);
let accessToken = localStorage.getItem('access_token');
let refreshToken = localStorage.getItem('refresh_token');
if (refreshToken !== undefined) getRefreshToken(refreshToken);

const authHeader = {
    "Authorization": localStorage.getItem('token_type') + ' ' + accessToken
}
