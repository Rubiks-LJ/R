(function () {
    const requestType = "rubiks-avatar-search-request";
    const responseType = "rubiks-avatar-search-response";

    window.addEventListener("message", async (event) => {
        if (event.source !== window || event.origin !== window.location.origin || event.data?.type !== requestType) return;
        const { id, url, options = {} } = event.data;
        try {
            const response = await fetch(url, { ...options, credentials: "include" });
            window.postMessage({
                type: responseType,
                id,
                ok: response.ok,
                status: response.status,
                body: await response.text(),
            }, window.location.origin);
        } catch (error) {
            window.postMessage({ type: responseType, id, error: error.message }, window.location.origin);
        }
    });
})();