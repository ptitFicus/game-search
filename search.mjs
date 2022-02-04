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
          `${input} n'est pas acceptable, les réponses acceptables sont : ${options.join(
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
    .map((a) => {
      return {
        name: a.querySelector("h4").textContent,
        url: `https://www.okkazeo.com${a.href}`,
      };
    });
}

function extractAnnoncePages(html) {
  const dom = new JSDOM(html);

  const editionCount = Number(
    [...dom.window.document.querySelectorAll("h3")]
      .map((h) => h.textContent)
      .filter((t) => t.includes("édition"))[0]
      .split(" ")[0]
  );

  return [...dom.window.document.querySelectorAll(".mbs.cell")]
    .splice(0, editionCount)
    .filter((p) => p.textContent.includes("A partir de"))
    .map((p) => p.querySelector("a"))
    .map((a) => a.href);
}

function extractUserFromAnnoncePage(html) {
  const dom = new JSDOM(html);
  return [...dom.window.document.querySelectorAll(".mbs article")].map(
    (article) => {
      const user = article.querySelector(".lien_membre .membre").href;
      const price = Number(
        article.querySelector(".prix").textContent.replace("€", ".")
      );

      return { user, price };
    }
  );
}

function extractUserFromSearch(search) {
  return http(
    `https://www.okkazeo.com/jeux/searchJeux?rech_nom=${search}`,
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
        "Que jeu ? ",
        Array.from(Array(games.length).keys())
      ).then((index) => games[index]);
    })
    .then(({ url }) => {
      return http(url, extractAnnoncePages);
    })
    .then((urls) =>
      Promise.all(
        urls.map((url) =>
          http(`https://www.okkazeo.com${url}`, extractUserFromAnnoncePage)
        )
      )
    )
    .then((arr) => arr.flat());
}

const users = await readlinePromise("Quel jeu souhaitez vous chercher ? ").then(
  (search) => extractUserFromSearch(search)
);

if (users.length === 0) {
  console.log("Ce jeu n'est pas à vendre");
} else {
  const others = await readlinePromise(
    "Quel autre jeu souhaitez vous chercher ? "
  ).then((search) => extractUserFromSearch(search));

  const result = insersection(users, others);
  if (result.length === 0) {
    console.log("Aucun membre ne vend tous ces jeux");
  } else {
    console.log(`${result.length} utilisateur(s) trouvé(s) :`);
    console.log(
      result
        .map(({ user, price }) => `https://www.okkazeo.com${user} (${price} €)`)
        .join("\n")
    );
  }
}

function insersection(users1, users2) {
  let map = users1.reduce((acc, { user, price }) => {
    acc.set(user, { price, count: 1 });
    return acc;
  }, new Map());

  map = users2.reduce((acc, { user, price }) => {
    if (map.has(user)) {
      let currPrice = map.get(user).price;
      acc.set(user, { price: currPrice + price, count: 2 });
    }
    return acc;
  }, map);

  return [...map.entries()]
    .filter(([user, { count, price }]) => count >= 2)
    .map(([user, { count, price }]) => ({ user, price }));
}
