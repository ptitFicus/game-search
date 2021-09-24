import fetch from "node-fetch";
import { JSDOM } from "jsdom";
import readline from "readline";

function readlinePromise(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve, reject) => {
    rl.question(question, (input) => {
      rl.close();
      resolve(input);
    });
  });
}

const searchGameUrl = "https://www.okkazeo.com/jeux/searchJeux?rech_nom=";

function http(url, callback) {
  console.log("fetching", url);
  return fetch(url)
    .then((response) => response.text())
    .then(callback);
}

function extractSearchResults(html) {
  const dom = new JSDOM(html);
  return [...dom.window.document.querySelectorAll("a")]
    .filter((a) => a.title.includes("Voir les jeux"))
    .filter((a) => !a.classList.contains("button"))
    .map((a) => ({
      name: a.textContent,
      url: `https://www.okkazeo.com${a.href}`,
    }));
}

function extractAnnoncePages(html) {
  const dom = new JSDOM(html);

  const editionCount = Number(
    [...dom.window.document.querySelectorAll("h3")]
      .map((h) => h.textContent)
      .filter((t) => t.includes("édition"))[0]
      .split(" ")[0]
  );

  return [...dom.window.document.querySelectorAll(".mbs div.small-3")]
    .splice(0, editionCount)
    .filter((p) => p.textContent.includes("A partir de"))
    .map((p) => p.querySelector("a"))
    .map((a) => a.href);
}

function extractUserFromAnnoncePage(html) {
  const dom = new JSDOM(html);
  return [...dom.window.document.querySelectorAll(".lien_membre .membre")].map(
    (a) => a.href
  );
}

const search = process.argv[2];

function extractUserFromSearch(search) {
  return http(
    `https://www.okkazeo.com/jeux/searchJeux?rech_nom=}${search}`,
    extractSearchResults
  )
    .then((games) => {
      games.forEach((game, index) => console.log(`${index} : ${game.name}`));
      return games;
    })
    .then((games) => {
      if (games.length === 0) {
        throw new Error("No game found");
      }
      if (games.length === 1) {
        return games[0];
      }
      return readlinePromise("Which one ? ").then((index) => games[index]);
    })
    .then(({ url }) => http(url, extractAnnoncePages))
    .then((urls) =>
      Promise.all(
        urls.map((url) =>
          http(`https://www.okkazeo.com${url}`, extractUserFromAnnoncePage)
        )
      )
    )
    .then((arr) => arr.flat())
    .then(console.log); // TODO ask user for selection
}

await extractUserFromSearch(search);
