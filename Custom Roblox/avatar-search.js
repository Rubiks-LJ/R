(function () {
    const searchId = "rubiks-avatar-search";
    const resultsId = "rubiks-avatar-search-results";
    const inventoryCache = new Map();
    const assetTypes = {
        accessories: [8, 41, 42, 43, 44, 45, 46, 47],
        clothing: [2, 11, 12],
    };

    const requestThroughPage = (url, options = {}) => new Promise((resolve, reject) => {
        const id = `${Date.now()}-${Math.random()}`;
        const timeout = setTimeout(() => {
            window.removeEventListener("message", onMessage);
            reject(new Error("Roblox request timed out"));
        }, 15000);
        const onMessage = (event) => {
            if (event.source !== window || event.origin !== window.location.origin || event.data?.type !== "rubiks-avatar-search-response" || event.data.id !== id) return;
            clearTimeout(timeout);
            window.removeEventListener("message", onMessage);
            if (event.data.error) {
                reject(new Error(event.data.error));
                return;
            }
            if (!event.data.ok) {
                reject(new Error(`Roblox request failed: ${event.data.status}`));
                return;
            }
            try {
                resolve(JSON.parse(event.data.body));
            } catch {
                reject(new Error("Roblox returned an invalid response"));
            }
        };
        window.addEventListener("message", onMessage);
        window.postMessage({ type: "rubiks-avatar-search-request", id, url, options }, window.location.origin);
    });

    const requestJson = async (url, options = {}) => {
        try {
            return await requestThroughPage(url, options);
        } catch (pageError) {
            try {
                const response = await fetch(url, { credentials: "include", ...options });
                if (!response.ok) throw new Error(`Roblox request failed: ${response.status}`);
                return response.json();
            } catch {
                throw pageError;
            }
        }
    };

    const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[character]));

    const getCategory = (toolbar) => {
        const active = toolbar.querySelector("[aria-selected='true'], .active, .selected");
        const label = active?.textContent?.toLowerCase() || toolbar.textContent?.toLowerCase() || "";
        return label.includes("accessor") ? "accessories" : "clothing";
    };

    const findRecentGrid = () => {
        const heading = [...document.querySelectorAll("h1, h2, h3, h4, span, div")]
            .filter((element) => element.textContent?.toLowerCase().includes("recently added"))
            .sort((left, right) => left.textContent.length - right.textContent.length)[0];
        let current = heading;
        for (let level = 0; current && level < 6; level += 1, current = current.parentElement) {
            const itemList = [...current.children]
                .filter((child) => child.querySelectorAll("img").length >= 5)
                .sort((left, right) => right.querySelectorAll("img").length - left.querySelectorAll("img").length)[0];
            if (itemList) return itemList;
            if (current.querySelectorAll("img").length >= 5) return current;
        }
        return null;
    };

    const filterRecentGrid = (grid, query) => {
        const items = [...grid.children].filter((item) => item.id !== resultsId);
        const orderedItems = items
            .map((item, index) => ({ item, index, matches: !query || item.textContent.toLowerCase().includes(query) }))
            .sort((left, right) => Number(right.matches) - Number(left.matches) || left.index - right.index);
        for (const { item, matches } of orderedItems) {
            item.hidden = !matches;
            grid.append(item);
        }
    };

    const getVisibleItemCards = () => {
        const cards = new Map();
        for (const image of document.querySelectorAll("img")) {
            let current = image.parentElement;
            for (let depth = 0; current && depth < 8; depth += 1, current = current.parentElement) {
                const labels = [...current.querySelectorAll("span, div, p, a")]
                    .filter((element) => !element.querySelector("img") && element.children.length === 0)
                    .map((element) => element.textContent.trim())
                    .filter((text) => text.length >= 2 && text.length <= 70);
                if (current.querySelectorAll("img").length === 1 && labels.length > 0) {
                    cards.set(current, labels[labels.length - 1]);
                    break;
                }
            }
        }
        return [...cards].filter(([card]) => !card.closest(`#${searchId}`) && card.getBoundingClientRect().width < 300);
    };

    const filterVisibleItemCards = (query) => {
        const cards = getVisibleItemCards();
        const matching = cards.filter(([, name]) => name.toLowerCase().includes(query));
        for (const [card] of cards) card.hidden = Boolean(query) && !matching.some(([match]) => match === card);
        for (const [card] of matching) card.parentElement?.append(card);
    };

    const getOwnedAssets = async (category) => {
        if (inventoryCache.has(category)) return inventoryCache.get(category);
        const user = await requestJson("https://users.roblox.com/v1/users/authenticated");
        const assets = [];
        for (const assetTypeId of assetTypes[category]) {
            let cursor = "";
            for (let page = 0; page < 3; page += 1) {
                const params = new URLSearchParams({ assetTypeId: String(assetTypeId), itemsPerPage: "100", sortOrder: "Desc" });
                if (cursor) params.set("cursor", cursor);
                const pageData = await requestJson(`https://inventory.roblox.com/v1/users/${user.id}/assets?${params}`);
                assets.push(...(pageData.data || []));
                cursor = pageData.nextPageCursor;
                if (!cursor) break;
            }
        }
        const uniqueAssets = [...new Map(assets.map((asset) => [asset.id, asset])).values()];
        inventoryCache.set(category, uniqueAssets);
        return uniqueAssets;
    };

    const getDetails = async (assets) => {
        if (!assets.length) return [];
        const details = await requestJson("https://catalog.roblox.com/v1/catalog/items/details", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: assets.map((asset) => ({ itemType: "Asset", id: asset.id })) }),
        });
        const thumbnails = await requestJson(`https://thumbnails.roblox.com/v1/assets?assetIds=${assets.map((asset) => asset.id).join(",")}&size=150x150&format=Png&isCircular=false`);
        return (details.data || []).map((detail) => ({
            ...detail,
            imageUrl: thumbnails.data?.find((thumbnail) => thumbnail.targetId === detail.id)?.imageUrl || "",
        }));
    };

    const findSearchMount = () => {
        const knownMount = document.querySelector(".avatar-editor-toolbar, .avatar-editor-header, [data-testid='avatar-editor-toolbar'], [data-testid='avatar-editor-header']");
        if (knownMount) return knownMount;

        const recentTab = [...document.querySelectorAll("button, a, [role='tab']")]
            .find((element) => element.textContent?.trim().toLowerCase() === "recent");
        return recentTab?.closest("[role='tablist'], nav, ul") || recentTab?.parentElement;
    };

    const addSearch = (toolbar) => {
        if (document.getElementById(searchId)) return;
        const wrapper = document.createElement("div");
        wrapper.id = searchId;
        wrapper.innerHTML = `<input type="search" placeholder="Search" aria-label="Search owned avatar items">`;
        const input = wrapper.querySelector("input");
        const results = document.createElement("div");
        results.id = resultsId;
        results.hidden = true;
        const runSearch = () => {
            const query = input.value.trim().toLowerCase();
            const recentGrid = findRecentGrid();
            if (recentGrid) filterRecentGrid(recentGrid, query);
            filterVisibleItemCards(query);
        };
        toolbar.style.position ||= "relative";
        toolbar.append(wrapper);
    };

    const observeAvatarEditor = () => {
        if (!/(^|\/)avatar(?:\/|$)/i.test(location.pathname)) return;
        const observer = new MutationObserver(() => {
            const toolbar = findSearchMount();
            if (toolbar) addSearch(toolbar);
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
        const toolbar = findSearchMount();
        if (toolbar) addSearch(toolbar);
    };

    observeAvatarEditor();
})();