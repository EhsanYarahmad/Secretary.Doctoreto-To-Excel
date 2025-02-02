chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "mergeAndDownloadExcel") {
        console.log("📥 پیام `mergeAndDownloadExcel` دریافت شد.");

        chrome.storage.local.get("tempTableData", (result) => {
            if (result.tempTableData) {
                console.log("📤 ارسال پیام `triggerExcelDownload` به `popup.js`...");
                chrome.runtime.sendMessage({ action: "triggerExcelDownload", data: result.tempTableData });
            } else {
                console.error("❌ خطا: داده‌ای برای خروجی یافت نشد!");
            }
        });

        return true;
    }
});
