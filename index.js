const request = require('request');
const prettyTime = require("pretty-time")
const express = require("express");
const rateLimit = require("express-rate-limit");
const app = express();


const port = 5000;
const userId = process.env.USER_ID;
const apiKey = process.env.API_KEY;
const errorMessage = process.env.ERROR_MESSAGE || "An error has occurred. Please send me a DM, letting me know and whether you would like me to add extra time or requirements to my session as a punishment";
const noMoreReqsUntilBelow = parseInt(process.env.NoMoreReqsUntilBelow);

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
  url: `https://api.emlalock.com/${path}`,
  json: true
});

const pretty = m => prettyTime([m, 0], 'm');

const buildQueryPath = function (method) {

  let setFrom = true;
  let setTo = false;

  let fromValue = 0;
  let fromName = method.endsWith("random") ? "from" : "value";;
  let toValue = 0;

  let message = "";

  switch (method) {
    case "info":
      setFrom = false;
      break;
    case "add":
    case "addminimum":
    case "addmaximum":
      fromValue = rand(OneHour, OneDay);

      message = `Thank you for adding ${pretty(fromValue)} to my ${method === "add" ? "duration" : method === "addmaximum" ? "maximum duration" : "minimum duration"}`;
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

      message = `Thank you for adding somewhere between ${pretty(fromValue)} and ${pretty(toValue)} to my ${method === "add" ? "duration" : method === "addmaximum" ? "maximum duration" : "minimum duration"}`;
      break;
    case "addrequirementrandom":
      fromValue = minRequirement;

      setTo = true;
      toValue = maxRequirement;

      message = `Thank you for giving me somewhere between ${fromValue} and ${toValue} extra requirements`;
      break;
    default:
      break;
  }

  let from = setFrom ? `&${fromName}=${fromValue}` : "";
  let to = setTo ? `&to=${toValue}` : "";
  return {
    Url: `${method}?userid=${userId}&apikey=${apiKey}${from}${to}`,
    Message: message
  };

}

const run = function (res) {

  let infoQuery = buildQueryPath("info");
  request.get(getOptions(infoQuery.Url), (err, result, userInfo) => {

    if (result.statusCode !== 200 && result.statusCode !== 304) {
      res.send("Cannot access API info for user " + userInfo.user.username);
      return;
    }

    if (!userInfo.chastitysession.hasOwnProperty("minduration")) {
      res.send("User " + userInfo.user.username + " is not currently in an active session");
      return;
    }

    var allowedMethods = ["add", "addrandom"];

    if (userInfo.chastitysession.minduration > 0) {
      allowedMethods.push("addminimum");
      allowedMethods.push("addminimumrandom");
    }
    if (userInfo.chastitysession.maxduration > 0) {
      allowedMethods.push("addmaximum");
      allowedMethods.push("addmaximumrandom");
    }
    if (userInfo.chastitysession.requirements > 0 && userInfo.chastitysession.requirements < noMoreReqsUntilBelow) {
      
      if (userInfo.chastitysession.requirements === 1) {
        // If user is on their last requirement then let's make sure they get a few more.
        // Better hope no one calls this while you're on your last one!
        allowedMethods = [];
      }
      
      allowedMethods.push("addrequirement");
      allowedMethods.push("addrequirementrandom");
    }

    let selectedMethod = allowedMethods[rand(0, allowedMethods.length - 1)];

    let queryProps = buildQueryPath(selectedMethod);
    let query = getOptions(queryProps.Url);
    console.log("Executing API call - " + query.url)
    request.get(query, function (x, y, z) {
      console.log("StatusCode: " + y.statusCode + "\nStatusMessage: " + y.statusMessage);
      
      var success = y.statusCode < 400;
      
      if (success) {
        var message = queryPrope.Message + "\n- " + userInfo.user.username;
        res.send(message);
      } else {
        res.send(errorMessage);
      }
      
    });

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
