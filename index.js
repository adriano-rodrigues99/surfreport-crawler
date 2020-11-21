const puppeteer = require("puppeteer");
const { format } = require("date-fns");
const fs = require("fs");
const reportDir = "surf_report";

const openReportPage = async () => {
  const browser = await puppeteer.launch({
    headless: false,
  });
  const page = await browser.newPage();
  await page.goto("https://www.facebook.com/shorelinefloripa/posts", {
    waitUntil: "networkidle2",
  });
  await page.click('a[action="cancel"]');
  return [page, browser];
};

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

const deleteLoginAlertElement = async (page, selector) => {
  try {
    await page.waitFor(selector);
    await page.evaluate((selector) => {
      var elements = document.querySelectorAll(selector);
      for (const element of elements) {
        element.parentNode.removeChild(element);
      }
    }, selector);
  } catch (err) {
    console.log(`Error to delete login alert element: ${err}`);
  }
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

const writeFile = (path, file) => {
  fs.writeFile(path, file, (err) => {
    if (err) console.log(`Error writing file: ${err}`);
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
    writeFile(
      `./${reportDir}/${new Date().getTime()}.png`,
      await viewSource.buffer()
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
  writeFile(
    `./${reportDir}/${format(new Date(), "dd-MM-yy HH:mm:ss")}.json`,
    JSON.stringify({ report })
  );
};

(async () => {
  const [page, browser] = await openReportPage();
  await deleteLoginAlertElement(page, "#pagelet_growth_expanding_cta");
  const navigateSuccess = await goToTodayReport(page);
  await deleteLoginAlertElement(page, "#u_0_c");

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
