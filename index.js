const express = require("express");
const app = express();
const Handlebars = require("hbs");

const { QuickDB } = require("quick.db");
const db = new QuickDB();

const aes256 = require("aes256");

const settings = require("./settings.json");

// save data to database
async function dbset(key, value) {
  await db.set(key, value)
}
// get data from database
async function dbget(key) {
  return await db.get(key)
}
// is database has data
async function dbhas(key) {
  return await db.has(key)
}
// get all data from database
async function dball() {
  return await db.all()
}
// delete data from database
async function dbdelete(key) {
  await db.delete(key)
}
// check database
async function checkDb() {
  let status = true;
  try {
    await db.has("test")
  } catch {
    status = false;
  }
  return status;
}

function decrypt(key, hash) {
  try {
  return aes256.decrypt(key, hash)
  } catch {
    return hash;
  }
}

function generateKey() {
  return Math.random().toString(36).slice(-10)+Math.random().toString(36).slice(-10)+Math.random().toString(36).slice(-10);
}

var queue = new Map();

app.set('view engine', 'hbs');
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

app.get("/", (req, res) => {
    res.render(__dirname+"/"+"index.hbs", {c:""});
})
app.post("/", async (req, res) => {
    let key = false;
    if(!req.body.content) return res.render(__dirname+"/"+"index.hbs", {c:"Content cannot be empty."})
    if(req.body.content.length > settings.charlimit) return res.render(__dirname+"/"+"index.hbs", {c:`Character limit exceeded! (${settings.charlimit})`});
    if(!checkDb()) return res.status(500).render(__dirname+"/"+"index.hbs", {c:"Couldn't save the paste. Please try again later."})
    if(req.body.encrypt === "on") {
      key = generateKey()
      req.body.content = aes256.encrypt(key, req.body.content);
    }
    let random = Math.random().toString(36).slice(-8)
    do {
      random = Math.random().toString(36).slice(-8)
    } while (await dbhas(random))
    let deletion_key = generateKey()
    await dbset(random, {"content": req.body.content, "deletion_key": deletion_key, "encrypted": req.body.encrypt === "on"})
    queue.set(random, true)
  res.redirect(`//${req.headers["x-forwarded-host"] ? req.headers["x-forwarded-host"] : req.headers.host}/${random}${key?'?key='+key:''}`)
})

app.get("/style.css", (_, res) => {
    res.sendFile(__dirname+"/"+"style.css")
})
app.get("/highlight.min.css", (_, res) => {
    res.sendFile(__dirname+"/"+"highlight.min.css")
})
app.get("/highlight.min.js", (_, res) => {
    res.sendFile(__dirname+"/"+"highlight.min.js")
})

app.get("/raw/:paste", async (req, res) => {
    if(!checkDb()) return res.status(500).send("Couldn't get the paste. Please try again later.")
    if(req.params.paste && await dbhas(req.params.paste)) {
      var output = (await dbget(req.params.paste)).content;
      if(req.query.key) {
        output = decrypt(req.query.key, output);
      }
        res.type('text/plain')
        res.send(output)
    } else {
        res.status(404).send("Not found.")
    }
})

app.get("/:paste", async (req, res) => {
    if(!checkDb()) return res.status(500).render(__dirname+"/"+"error.hbs", {c:"Couldn't get the paste. Please try again later."})
    if(req.params.paste && await dbhas(req.params.paste)) {
      var output = (await dbget(req.params.paste)).content;
      var raw = `//${req.headers["x-forwarded-host"] ? req.headers["x-forwarded-host"] : req.headers.host}/raw/${req.params.paste}`;
      var isEncrypted = (await db.get(req.params.paste))["encrypted"] ? (await db.get(req.params.paste))["encrypted"] : false;
      if(req.query.key) {
        output = decrypt(req.query.key, output);
        raw += `?key=${req.query.key}`
      }
        res.render(__dirname+"/"+"paste.hbs", {
            c: output,
            r: raw,
            d: queue.has(req.params.paste) ? `<a href="//${req.headers["x-forwarded-host"] ? req.headers["x-forwarded-host"] : req.headers.host}/delete/${req.params.paste}?key=${(await dbget(req.params.paste)).deletion_key}">Click</a> to delete. You can't delete your paste after you leave the page.` : (isEncrypted ? "This paste is encrypted. If it doesn't look right, you may have the wrong key or don't have the key." : "")
        })
        queue.delete(req.params.paste);
    } else {
        res.status(404).render(__dirname+"/"+"error.hbs", {c:"Not found."})
    }
})

app.get("/delete/:paste", async (req, res) => {
  if(!checkDb()) return res.status(500).send("Couldn't get the paste. Please try again later.")
  if(req.params.paste && await dbhas(req.params.paste)) {
    if(req.query.key && req.query.key == (await dbget(req.params.paste)).deletion_key) {
      dbdelete(req.params.paste)
      res.render(__dirname+"/"+"index.hbs", {c:"Deleted."})
    } else {
      res.status(401).render(__dirname+"/"+"error.hbs", {c: "You don't have permission to delete this paste."})
    }
  } else {
    res.status(404).render(__dirname+"/"+"error.hbs", {c: "Not found."})
  }
})

var listener = app.listen(settings.port, async () => {
    console.log(`Server is listening on http(s)://${listener.address().address}:${listener.address().port} (${listener.address().family})`)
});
