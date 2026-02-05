console.log("ScamGuard Content Script Active");
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  // Ping check
  if (request.action === "PING") {
    sendResponse({ status: "ready" });
    return true;
  }

  if (request.action === "getPageText") {
    try {
      // Improved selector: Try to get main content first, fallback to body
      const mainContent = document.querySelector("main") || document.body;
      const pageText = mainContent.innerText
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 10000);

      sendResponse({ text: pageText, success: true });
    } catch (error) {
      console.error("ScamGuard Content Error:", error);
      sendResponse({ text: "Error extracting page text.", success: false });
    }
  }
  return true;
});
