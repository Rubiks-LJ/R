const normalizeUsername = (username) => username.toLowerCase().replace(/[\s'_]/g, "");
const authorizedUsernames = [
    "Rubiks_LJ",
    "Wextary",
    "mresdyu",
    "TsukiKage656",
];

export default function handler(request, response) {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (request.method === "OPTIONS") {
        return response.status(204).end();
    }

    if (request.method !== "POST") {
        return response.status(405).json({ authorized: false });
    }

    const username = typeof request.body?.username === "string"
        ? request.body.username.trim()
        : "";
    const authorized = Boolean(username) && authorizedUsernames.some((allowedUsername) =>
        normalizeUsername(allowedUsername) === normalizeUsername(username)
    );

    return response.status(200).json({ authorized });
}
