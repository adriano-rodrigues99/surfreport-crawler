const puppeteer = require("puppeteer");
const { format } = require("date-fns");
const fs = require("fs");

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

  const reportDir = "surf_report";
  if (haveImagesUrl && !fs.existsSync(reportDir)) fs.mkdirSync(reportDir);

  for (const imagem of imagesUrl) {
    console.log("Salvando imagem do boletim.");
    const viewSource = await page.goto(imagem, {
      waitUntil: "networkidle2",
    });

    fs.writeFile(
      `./surf_report/${new Date().getTime()}.png`,
      await viewSource.buffer(),
      function (err) {
        if (err) {
          return console.log(err);
        }
      }
    );
  }
  return haveImagesUrl;
};

(async () => {
  const [page, browser] = await openReportPage();
  const navigateSuccess = await goToTodayReport(page);

  if (navigateSuccess) {
    await page.waitForTimeout(2000);
    const [reportText, imagePages] = await findReportData(page);
    const haveImagesUrl = await downloadReportImages(page, imagePages);
    console.log(reportText);
    if (haveImagesUrl) fs.rmdirSync("surf_report", { recursive: true });
  }

  await browser.close();
})();
