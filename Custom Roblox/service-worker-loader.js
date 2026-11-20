import './assets/background.js-BHyQp_31.js';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message?.type !== "loadPlugin" || !sender.tab?.id) {
		return;
	}

	chrome.scripting.executeScript({
		target: { tabId: sender.tab.id, allFrames: true },
		files: ["assets/inject.js-ryo_DxjW.js"],
	}).then(() => sendResponse({ ok: true })).catch((error) => {
		console.error("Unable to load Rubiks Roblox Plugin", error);
		sendResponse({ ok: false });
	});

	return true;
});
