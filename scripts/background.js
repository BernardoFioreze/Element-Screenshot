chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "DOWNLOAD") {
    const { url, filename } = message;
    chrome.downloads.download(
      {
        url,
        filename: `ElementScreenshots/${filename}`,
        conflictAction: "uniquify",
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error("[ESS] Download falhou:", chrome.runtime.lastError.message);
          sendResponse({ ok: false });
        } else {
          sendResponse({ ok: true, downloadId });
        }
      }
    );
    return true; // mantém o canal aberto para sendResponse assíncrono
  }
});
