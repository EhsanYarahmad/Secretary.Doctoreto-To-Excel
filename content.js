chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "startExtraction") {
      console.log(`📡 شروع استخراج جدول... حداکثر ${message.maxPages} صفحه خوانده می‌شود.`);
      extractLimitedTablePages(message.maxPages);
      sendResponse({ status: "✅ دریافت شد، شروع استخراج!" });
  }
});


async function extractLimitedTablePages(maxPages = 5) {
  let allData = [];

  function getTable() {
      return document.querySelector("table");
  }

  async function waitForTable() {
      return new Promise((resolve) => {
          let table = getTable();
          if (table) {
              console.log("✅ جدول پیدا شد.");
              resolve(table);
              return;
          }

          console.log("🔍 جدول یافت نشد. منتظر تغییرات در DOM...");
          let observer = new MutationObserver(() => {
              table = getTable();
              if (table) {
                  console.log("✅ جدول بعد از تغییرات DOM پیدا شد!");
                  observer.disconnect();
                  resolve(table);
              }
          });

          observer.observe(document.body, { childList: true, subtree: true });
      });
  }

  async function getTableData() {
      let table = await waitForTable();
      let data = [];

      for (let row of table.rows) {
          let rowData = [];
          for (let cell of row.cells) {
              let text = cell.innerText.trim();
              text = text.replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)); // تبدیل اعداد فارسی به انگلیسی
              rowData.push(text);
          }
          data.push(rowData);
      }
      console.log(`📊 داده‌های استخراج‌شده از این صفحه: ${data.length} سطر`);
      return data;
  }

  async function goToNextPage() {
    console.log("🔍 جستجو برای دکمه صفحه‌بندی...");

    let buttons = document.querySelectorAll("button.MuiButtonBase-root.MuiIconButton-root");
    let nextButton = null;

    buttons.forEach((btn) => {
        let svg = btn.querySelector("svg");
        if (svg && svg.innerHTML.includes("M15.41 16.59 10.83 12l4.58-4.59L14 6l-6 6 6 6z") && !btn.disabled) {
            console.log("📌 دکمه 'بعدی' شناسایی شد:", btn.className);
            nextButton = btn;
        }
    });

    if (!nextButton) {
        console.log("🚫 دکمه صفحه بعدی یافت نشد یا غیرفعال است.");
        return false;
    }

    console.log("📌 کلیک روی دکمه 'بعدی'...");
    
    let oldTableContent = document.querySelector("table")?.innerText; // محتوای فعلی جدول

    nextButton.click(); // کلیک روی صفحه بعدی

    // **منتظر بمانیم تا جدول جدید بارگذاری شود**
    let newTableLoaded = false;
    let maxWaitTime = 10000; // حداکثر 10 ثانیه صبر کند
    let startTime = Date.now();

    while (!newTableLoaded && Date.now() - startTime < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, 500)); // هر 500 میلی‌ثانیه بررسی کند
        let newTableContent = document.querySelector("table")?.innerText;
        if (newTableContent && newTableContent !== oldTableContent) {
            newTableLoaded = true;
        }
    }

    if (newTableLoaded) {
        console.log("✅ صفحه جدید بارگذاری شد!");
        return true;
    } else {
        console.warn("⚠️ صفحه جدید بارگذاری نشد! احتمالاً مشکلی وجود دارد.");
        return false;
    }
}



  let pagesRead = 0;
  do {
      let pageData = await getTableData();
      if (pageData.length > 0) {
          allData = allData.concat(pageData);
          chrome.storage.local.set({ tempTableData: JSON.stringify(allData) });
      } else {
          console.warn("⚠️ این صفحه خالی بود!");
      }
      pagesRead++;
  } while (await goToNextPage() && pagesRead < maxPages);

  console.log(`📦 تعداد کل سطرهای استخراج‌شده: ${allData.length}`);

  if (allData.length > 0) {
      chrome.runtime.sendMessage({ action: "mergeAndDownloadExcel" });
  } else {
      alert("❌ خطا: هیچ داده‌ای استخراج نشد.");
  }
}
