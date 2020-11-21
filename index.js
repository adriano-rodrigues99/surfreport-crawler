const puppeteer = require("puppeteer");
const { format } = require("date-fns");
const fs = require("fs");
const reportDir = "surf_report";

const goToTodayReport = async (page) => {
  return await page.evaluate((today) => {
    let haveReport = false;
    const boletims = document.querySelectorAll('div[class="_4-u2 _4-u8"');
    boletims.forEach(async (boletim) => {
      const postText = boletim.querySelector('div[data-testid="post_message"]')
        .innerText;
      if (
        postText.indexOf("PLANTÃO DAS ONDAS SHORELINE") >= 0 &&
        postText.indexOf(today) >= 0
      ) {
        boletim.querySelectorAll('a[class="_5pcq"]')[0].click();
        haveReport = true;
      }
    });
    return haveReport;
  }, format(new Date(), "dd/MM/yy"));
};

const openReportPage = async () => {
  const browser = await puppeteer.launch({
    headless: true,
  });
  const page = await browser.newPage();
  await page.goto("https://www.facebook.com/shorelinefloripa/posts", {
    waitUntil: "networkidle2",
  });
  await page.click('a[action="cancel"]');
  return [page, browser];
};

const findReportData = async (page) => {
  return await page.evaluate((body) => {
    const text = document.querySelector('div[data-testid="post_message"]')
      .innerText;

    const { children } = document.querySelector('div[class="_2a2q _65sr"]');
    const childrens = Array.from(children);
    const imagePages = [];
    childrens.forEach((imagem) => {
      imagePages.push(imagem.href);
    });
    return [text, imagePages];
  });
};

const downloadReportImages = async (page, imagePages) => {
  const imagesUrl = [];
  for (const imagem of imagePages) {
    await page.goto(imagem, {
      waitUntil: "networkidle2",
    });

    const url = await page.evaluate((body) => {
      return document.getElementsByTagName("img")[0].src;
    });
    imagesUrl.push(url);
  }

  const haveImagesUrl = imagesUrl && imagesUrl.length > 0;
  if (haveImagesUrl && !fs.existsSync(reportDir)) fs.mkdirSync(reportDir);

  for (const imagem of imagesUrl) {
    const viewSource = await page.goto(imagem, {
      waitUntil: "networkidle2",
    });
    console.log("Saving surf report image...");
    fs.writeFile(
      `./${reportDir}/${new Date().getTime()}.png`,
      await viewSource.buffer(),
      (err) => {
        if (err) console.log(`Error writing file: ${err}`);
      }
    );
  }
  return haveImagesUrl;
};

const deleteLastReport = () => {
  try {
    fs.rmSync(reportDir, { recursive: true });
  } catch (e) {}
};

const writeReportText = (report) => {
  fs.writeFile(
    `./${reportDir}/${format(new Date(), "dd-MM-yy HH:mm:ss")}.json`,
    JSON.stringify({ report }),
    "utf8",
    (err) => {
      if (err) console.log(`Error writing file: ${err}`);
    }
  );
};

(async () => {
  const [page, browser] = await openReportPage();
  const navigateSuccess = await goToTodayReport(page);

  if (navigateSuccess) {
    deleteLastReport();
    await page.waitForTimeout(2000);
    const [reportText, imagePages] = await findReportData(page);
    if (imagePages && imagePages.length > 0) {
      const haveImagesUrl = await downloadReportImages(page, imagePages);
    }
    writeReportText(reportText);
  }

  await browser.close();
})();
