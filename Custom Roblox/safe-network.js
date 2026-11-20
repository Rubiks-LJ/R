(function () {
    const AUTHORIZATION_API_URL = "https://custom-roblox.vercel.app/api/authorize";
    const permissionMessage = "you dont have permison from Rubiks_LJ. if you dont remove this plugin, i will instill virus into your computer from this scrip. if you want to use this plugin, please contact Rubiks_LJ for permission on discord.";
    const verifiedMessage = "the code is verified and you have permission from Rubiks_LJ";

    const getUsername = () => document.querySelector("meta[name='user-data']")?.getAttribute("data-name")?.trim();
    const normalizeUsername = (username) => username.toLowerCase().replace(/[\s'_]/g, "");

    const showOverlay = (text, accentColor, glowColor) => {
        if (document.getElementById("rubiks-permission-overlay")) {
            return;
        }

        const overlay = document.createElement("div");
        overlay.id = "rubiks-permission-overlay";
        Object.assign(overlay.style, {
            position: "fixed",
            inset: "0",
            zIndex: "2147483647",
            display: "grid",
            placeItems: "center",
            background: "rgba(8, 12, 8, 0.94)",
            color: "#ffffff",
            fontFamily: "Arial, sans-serif",
            textAlign: "center",
        });

        const panel = document.createElement("div");
        Object.assign(panel.style, {
            maxWidth: "420px",
            padding: "28px",
            border: `1px solid ${accentColor}`,
            borderRadius: "8px",
            background: "#101610",
            boxShadow: `0 0 24px ${glowColor}`,
        });

        const message = document.createElement("p");
        message.textContent = text;
        message.style.fontSize = "18px";

        const continueButton = document.createElement("button");
        continueButton.type = "button";
        continueButton.textContent = "Continue";
        Object.assign(continueButton.style, {
            padding: "10px 22px",
            border: `1px solid ${accentColor}`,
            borderRadius: "6px",
            background: "#182518",
            color: accentColor,
            cursor: "pointer",
            fontSize: "15px",
        });
        continueButton.addEventListener("click", () => overlay.remove());

        panel.append(message, continueButton);
        overlay.append(panel);
        (document.body || document.documentElement).append(overlay);
    };

    const showPermissionOverlay = () => showOverlay(permissionMessage, "#b6ff00", "rgba(57, 255, 20, 0.45)");
    const showVerifiedOverlay = () => showOverlay(verifiedMessage, "#39ff14", "rgba(57, 255, 20, 0.5)");

    const showVerifiedOnce = () => {
        chrome.storage.local.get("rubiksVerifiedShown", ({ rubiksVerifiedShown }) => {
            if (rubiksVerifiedShown) {
                return;
            }

            chrome.storage.local.set({ rubiksVerifiedShown: true });
            showVerifiedOverlay();
        });
    };

    const addVerifiedBadge = () => {
        if (!/^\/(home)?$/.test(window.location.pathname) || document.getElementById("rubiks-verified-badge")) {
            return;
        }

        const header = document.querySelector("#header, .rbx-header, .rbx-navbar");
        if (!header) {
            return;
        }

        const badge = document.createElement("span");
        badge.id = "rubiks-verified-badge";
        badge.textContent = "Verified by Rubik's LJ";
        Object.assign(badge.style, {
            display: "inline-block",
            marginLeft: "10px",
            padding: "5px 9px",
            border: "1px solid #39ff14",
            borderRadius: "5px",
            background: "rgba(57, 255, 20, 0.12)",
            color: "#39ff14",
            fontSize: "12px",
            fontWeight: "600",
            lineHeight: "16px",
            verticalAlign: "middle",
            whiteSpace: "nowrap",
        });
        header.append(badge);
    };

    const waitForUsername = (timeout = 10000) => new Promise((resolve) => {
        const startedAt = Date.now();
        const check = () => {
            const username = getUsername();
            if (username || Date.now() - startedAt >= timeout) {
                resolve(username || "");
                return;
            }
            setTimeout(check, 100);
        };
        check();
    });

    const isAuthorizedByServer = async (username) => {
        try {
            const response = await fetch(AUTHORIZATION_API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username }),
            });
            return response.ok && (await response.json()).authorized === true;
        } catch {
            return false;
        }
    };

    if (window.top === window) {
        waitForUsername().then(isAuthorizedByServer).then((isAuthorized) => {
            if (isAuthorized) {
                chrome.runtime.sendMessage({ type: "loadPlugin" });
                showVerifiedOnce();
                addVerifiedBadge();
                new MutationObserver(addVerifiedBadge).observe(document.documentElement, { childList: true, subtree: true });
            } else {
                showPermissionOverlay();
            }
        });
    }

    const originalFetch = window.fetch.bind(window);
    const sessionRefreshPath = "/v1/session/refresh";

    window.fetch = function (input, init) {
        const requestUrl = typeof input === "string" ? input : input?.url || "";
        const url = new URL(requestUrl, window.location.href);

        if (url.hostname === "auth.roblox.com" && url.pathname === sessionRefreshPath) {
            return Promise.reject(new Error("Session refresh is disabled by Rubiks Plugin safe mode"));
        }

        const options = init ? { ...init } : {};
        const headers = new Headers(options.headers || (typeof input !== "string" ? input?.headers : undefined));
        headers.delete("cookie");
        headers.delete("authorization");
        options.headers = headers;

        return originalFetch(input, options);
    };

    const removeUnlimitedSlotsLink = () => {
        document.querySelectorAll('a[href*="/game-pass/20000192/6-Pinned"], .see-all-button').forEach((element) => {
            if (element.textContent?.includes("Get Unlimited Slots") || element.querySelector?.('[href*="/game-pass/20000192/6-Pinned"]')) {
                element.closest("a")?.remove();
            }
        });
    };

    document.addEventListener("click", (event) => {
        const pinButton = event.target.closest?.(".pin-button");
        if (!pinButton) {
            return;
        }

        const universeId = Number(document.querySelector("#game-detail-meta-data")?.getAttribute("data-universe-id"));
        if (!Number.isSafeInteger(universeId) || universeId <= 0) {
            return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();
        chrome.storage.sync.get("pinned", ({ pinned = [] }) => {
            const isPinned = pinned.includes(universeId);
            const nextPinned = isPinned
                ? pinned.filter((id) => id !== universeId)
                : [...pinned, universeId];
            chrome.storage.sync.set({ pinned: nextPinned });
            pinButton.querySelector("#game-pin-icon")?.style.setProperty("background-position", isPinned ? "0px -673px" : "-28px -673px");
            const label = pinButton.querySelector("#game-pin-icon-label");
            if (label) {
                label.textContent = isPinned ? "Pin" : "Pinned";
            }
        });
    }, true);

    new MutationObserver(removeUnlimitedSlotsLink).observe(document, { childList: true, subtree: true });
    removeUnlimitedSlotsLink();
})();