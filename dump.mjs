import fetch from "node-fetch";
import { JSDOM } from "jsdom";
import readline from "readline";

function readlinePromise(question, options = []) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve, reject) => {
    rl.question(question, (input) => {
      rl.close();
      if (options.length === 0) {
        resolve(input);
      } else if (options.includes(Number(input))) {
        resolve(input);
      } else {
        console.log(
          `${input} is not an acceptable answer, acceptable answer are : ${options.join(
            ", "
          )}`
        );
        resolve(readlinePromise(question, options));
      }
    });
  });
}

const searchGameUrl = "https://www.okkazeo.com/jeux/searchJeux?rech_nom=";

function http(url, callback) {
  //console.log("fetching", url);
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
      return readlinePromise(
        "Which one ? ",
        Array.from(Array(games.length).keys())
      ).then((index) => games[index]);
    })
    .then(({ url }) => http(url, extractAnnoncePages))
    .then((urls) =>
      Promise.all(
        urls.map((url) =>
          http(`https://www.okkazeo.com${url}`, extractUserFromAnnoncePage)
        )
      )
    )
    .then((arr) => arr.flat());
}

const users = new Set(
  await readlinePromise("Quel jeu souhaitez vous chercher ? ").then((search) =>
    extractUserFromSearch(search)
  )
);

if (users.length === 0) {
  console.log("Ce jeu n'est pas à vendre");
} else {
  const others = new Set(
    await readlinePromise("Quel autre jeu souhaitez vous chercher ? ").then(
      (search) => extractUserFromSearch(search)
    )
  );
  const result = insersection(users, others);
  if (result.length === 0) {
    console.log("Aucun membre ne vend tous ces jeux");
  } else {
    console.log(`${result.length} utilisateur(s) trouvé(s) :`);
    console.log(
      result.map((user) => `https://www.okkazeo.com${user}`).join("\n")
    );
  }
}

function insersection(set1, set2) {
  return [...set1].filter((el) => set2.has(el));
}
