const request = require('request');
const prettyTime = require("pretty-time")
const express = require("express");
const rateLimit = require("express-rate-limit");
const app = express();


const port = 5000;
const userId = process.env.USER_ID;
const apiKey = process.env.API_KEY;

const maxHitsPerIPPerMinute = parseInt(process.env.MAX_HITS_PER_IP_PER_MINUTE);

const OneMinute = 60;
const OneHour = OneMinute * 60;
const OneDay = OneHour * 24;
const OneWeek = OneDay * 7;

const minRequirement = parseInt(process.env.MIN_REQUIREMENT);
const maxRequirement = parseInt(process.env.MAX_REQUIREMENT);

const rand = function (min, max) { // min and max included 
  return Math.floor(Math.random() * (max - min + 1) + min);
};

const getOptions = path => ({
  url: `https://emlalock.com/${path}`,
  json: true
});

const pretty = m => prettyTime([m, 0], 'm');

const buildQueryPath = function (method) {

  let setFrom = true;
  let setTo = false;

  let fromValue = 0;
  let fromName = "";
  let toValue = 0;

  let message = method.endsWith("random") ? "from" : "value";

  switch (method) {
    case "info":
      setFrom = false;
      break;
    case "add":
    case "addminimum":
    case "addmaximum":
      fromValue = rand(OneHour, OneDay);

      message = `Thank you for adding ${pretty(fromValue)} to my ${ method === "add" ? "duration" : method === "addmaximum" ? "maximum duration" : "minimum duration"}`; 
      break;
    case "addrequirement":
      fromValue = rand(minRequirement, maxRequirement);

      message = `Thank you for giving me ${fromValue} extra ${fromValue === 1 ? "requirement" : "requirements"}`;
      break;

    case "addrandom":
    case "addminimumrandom":
    case "addmaximumrandom":
      fromValue = rand(OneHour, OneDay);

      setTo = true;
      toValue = rand(OneDay, OneWeek);

      message = `Thank you for adding somewhere between ${pretty(fromValue)} and ${pretty(toValue)} to my ${ method === "add" ? "duration" : method === "addmaximum" ? "maximum duration" : "minimum duration"}`; 
      break;
    case "addrequirementrandom":
      fromValue = minRequirement;

      setTo = true;
      toValue = maxRequirement;

      message = `Thank you for giving me somwewhere between ${fromValue} and ${toValue} extra requirements`;
      break;
    default:
      break;
  }

  let from = setFrom ? `&${fromName}=${fromValue}` : "";
  let to = setTo ? `$to=${toValue}` : "";
  return {
    Url: `${method}?userid=${userId}&apikey=${apiKey}${from}${to}`,
    Message: message
  };

}

const run = function (res) {

  let infoQuery = buildQueryPath("info");
  request.get(getOptions(infoQuery.Url), (err, result, userInfo) => {

    var allowedMethods = ["add", "addrandom"];

    if (userInfo.chastitysession.minduration > 0) {
      allowedMethods.push("addminimum");
      allowedMethods.push("addminimumrandom");
    }
    if (userInfo.chastitysession.maxduration > 0) {
      allowedMethods.push("addmaximum");
      allowedMethods.push("addmaximumrandom");
    }
    if (userInfo.chastitysession.requirements > 0) {
      allowedMethods.push("addrequirement");
      allowedMethods.push("addrequirementrandom");
    }

    let selectedMethod = allowedMethods[rand(0, allowedMethods.length - 1)];

    let queryProps = buildQueryPath(selectedMethod);
    let query = getOptions(queryProps.Url);
    request.get(query, function (x, y, z) { res.send(queryProps.Message); });

  });

}

// Rate limit
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: maxHitsPerIPPerMinute, // limit each IP to maxHitsPerIPPerMinute requests per windowMs
  message: "Too many requests, please try again in a moment"
});

//  apply to all requests
app.use(limiter);

// Body parser
app.use(express.urlencoded({ extended: false }));

// Home route
app.get("/", (req, res) => {
   run(res);
});

// Listen on port 5000
app.listen(port, () => {
  console.log(`Running`);
});
