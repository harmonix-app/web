const CLIENT_ID = 'f5261a72ae4d4dab8a746aeec4dd3b4b';

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

    const scope = 'user-modify-playback-state user-read-private user-read-email';
    const authUrl = new URL("https://accounts.spotify.com/authorize")

    window.localStorage.setItem('code_verifier', codeVerifier);

    authUrl.search = new URLSearchParams({
        response_type: 'code',
        client_id: CLIENT_ID,
        scope,
        code_challenge_method: 'S256',
        code_challenge: codeChallenge,
        redirect_uri: 'http://localhost:3000',
    }).toString();

    window.location.href = authUrl.toString();
}

function getToken() {
    console.debug("Fetching token");
    let codeVerifier = localStorage.getItem('code_verifier');
    let code = urlParams.get('code');

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
            localStorage.setItem('access_token', json.access_token);
        })
        .catch(e => console.error("Failed to get token:", e));
}

const urlParams = new URLSearchParams(window.location.search);

getToken();
let accessToken = localStorage.getItem('access_token');

addEventListener("DOMContentLoaded", function () {
    const uid = document.getElementById('uid');
    const ulm = document.getElementById('ulm');

    console.debug("Sending request to /me to get user details")
    fetch("https://api.spotify.com/v1/me", {
        "method": "GET",
        "headers": {
            "Authorization": "Bearer " + accessToken
        }
    })
        .then(response => response.json())
        .then(json => {
            if (json.error) {
                uid.innerText = `API Error ${json.error.status}`
                ulm.innerText = `${json.error.message} ${accessToken === "undefined" ? "(are you logged in?)" : ""}`
                console.error("API Error at /me:", json.error)
            } else {
                console.debug("Logged in:", json)
                uid.innerText = `Logged in as ${json.display_name}`
                ulm.innerText = json.email
            }
        })
        .catch(e => uid.innerText = `Failed to authenticate:\n${e}`);
})

function btn() {
    fetch("https://api.spotify.com/v1/me/player/pause", {
        "method": "PUT",
        "headers": {
            "Authorization": "Bearer " + accessToken
        }
    })
        .then(response => response.json())
        .then(json => console.log(json))
        .catch(e => console.error("Error :(", e));
}
