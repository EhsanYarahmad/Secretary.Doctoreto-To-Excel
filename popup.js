chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "triggerExcelDownload") {
      console.log("📥 پیام `triggerExcelDownload` دریافت شد. در حال ساخت فایل اکسل...");
      generateExcel(JSON.parse(message.data));
  }
});

document.getElementById("exportExcel").addEventListener("click", () => {
  let maxPages = prompt("📄 چند صفحه را می‌خواهید استخراج کنید؟ (عدد وارد کنید)", "5");
  if (!maxPages || isNaN(maxPages) || maxPages <= 0) {
      alert("❌ لطفاً یک عدد معتبر وارد کنید.");
      return;
  }

  chrome.storage.local.get("tempTableData", (result) => {
      if (result.tempTableData) {
          let userChoice = confirm("📦 داده‌های قبلی موجود هستند! آیا می‌خواهید فایل اکسل دانلود شود؟\n\nOK: دانلود فایل\nCancel: ادامه استخراج و جایگزینی داده‌ها");
          if (userChoice) {
              generateExcel(JSON.parse(result.tempTableData));
          } else {
              chrome.storage.local.remove("tempTableData", () => {
                  alert("🗑️ داده‌های قبلی پاک شدند. لطفاً فرآیند استخراج را دوباره شروع کنید.");
                  startExtraction(parseInt(maxPages, 10));
              });
          }
      } else {
          startExtraction(parseInt(maxPages, 10));
      }
  });
});

function startExtraction(maxPages) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) {
          console.error("❌ خطا: تب فعال پیدا نشد!");
          return;
      }

      chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          files: ["content.js"]
      }, () => {
          if (chrome.runtime.lastError) {
              console.error("❌ خطا در اجرای `content.js`:", chrome.runtime.lastError.message);
          } else {
              console.log("✅ `content.js` بارگذاری شد. ارسال پیام `startExtraction`...");
              chrome.tabs.sendMessage(tabs[0].id, { action: "startExtraction", maxPages: maxPages }, (response) => {
                  if (chrome.runtime.lastError) {
                      console.error("❌ خطا در ارسال پیام به `content.js`:", chrome.runtime.lastError.message);
                  } else {
                      console.log("📩 پیام `startExtraction` ارسال شد. پاسخ:", response);
                  }
              });
          }
      });
  });
}


function generateExcel(data) {
  if (!data || data.length === 0) {
      alert("❌ خطا: هیچ داده‌ای برای خروجی وجود ندارد.");
      return;
  }

  console.log("📥 ساخت فایل اکسل...");

  // **حذف هدرهای تکراری**
  let headers = data[0]; // گرفتن اولین سطر به عنوان هدر اصلی
  let filteredData = [headers]; // اضافه کردن هدر فقط یک بار

  for (let i = 1; i < data.length; i++) {
      let row = data[i];

      // بررسی اینکه آیا ردیف فعلی همانند هدر است
      let isDuplicateHeader = row.join(",") === headers.join(",");
      if (!isDuplicateHeader) {
          filteredData.push(row);
      }
  }

  // **تبدیل ستون "زمان نوبت" به دو ستون "تاریخ" و "ساعت"**
  let dateIndex = headers.findIndex(h => h.includes("زمان نوبت"));
  if (dateIndex !== -1) {
      headers.splice(dateIndex, 1, "تاریخ", "ساعت"); // جایگزینی ستون تاریخ و ساعت
      for (let i = 1; i < filteredData.length; i++) {
          let dateTime = filteredData[i][dateIndex];
          if (dateTime) {
              let [datePart, timePart] = dateTime.split(" ");
              datePart = datePart.replace(/\//g, "-"); // تبدیل `/` به `-`
              filteredData[i].splice(dateIndex, 1, datePart, timePart);
          }
      }
  }

  // **اصلاح ستون وضعیت (ستون J)**
  let statusIndex = headers.findIndex(h => h.includes("وضعیت"));
  if (statusIndex !== -1) {
      for (let i = 1; i < filteredData.length; i++) {
          let statusValue = filteredData[i][statusIndex];
          if (statusValue.includes("لغو شده")) {
              filteredData[i][statusIndex] = "لغو شده"; // حذف ساعت از مقدار
          }
      }
  }

  // **حذف ستون‌های `E`, `F`, و `J`**
  let columnsToRemove = [5, 6, 10]; // ایندکس‌های E, F, J (صفر-محور)
  let cleanedData = filteredData.map(row => row.filter((_, index) => !columnsToRemove.includes(index)));

  let ws = XLSX.utils.aoa_to_sheet(cleanedData);

  // **اعمال استایل برای هدر جدول**
  let headerStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "4F81BD" } }, // پس‌زمینه آبی
      border: {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } }
      }
  };

  let range = XLSX.utils.decode_range(ws["!ref"]);
  for (let C = range.s.c; C <= range.e.c; ++C) {
      let cell = ws[XLSX.utils.encode_cell({ r: 0, c: C })];
      if (cell) cell.s = headerStyle;
  }

  let wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "جدول کامل");

  XLSX.writeFile(wb, "full_table.xlsx");
  console.log("✅ فایل اکسل ساخته شد.");
}
