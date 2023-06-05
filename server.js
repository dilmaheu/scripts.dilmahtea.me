// @ts-check

import * as dotenv from "dotenv";

dotenv.config({
  path: "/home/strapi/scripts/.env",
});

import fs from "fs";
import zlib from "zlib";
import express from "express";
import getRawBody from "raw-body";
import morganBody from "morgan-body";
import serveIndex from "serve-index";
import cookieParser from "cookie-parser";
import dispatchWorkflowRequest from "./utils/dispatchWorkflowRequest.js";

const app = express(),
  PORT = 4000;

app.use(express.json());
app.use(cookieParser());

app.use(
  "/logs",
  (req, res, next) => {
    if (req.cookies["password"] !== process.env.LOGS_DIR_PASSWORD) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");

      res.status(401);

      res.send(
        `
          <script type="module">
            const password = prompt("Enter password"),
              digestData = new TextEncoder().encode(password),
              passwordHash = await window.crypto.subtle.digest(
                "SHA-256",
                digestData
              );

            const passwordHashHex = Array.from(new Uint8Array(passwordHash))
              .map((byte) => byte.toString(16).padStart(2, "0"))
              .join("");

            document.cookie = "password=" + passwordHashHex;

            location.reload();
          </script>
        `
      );

      return;
    }

    next();
  },
  express.static("/home/strapi/scripts/logs"),
  serveIndex("/home/strapi/scripts/logs", { icons: true })
);

morganBody(app, {
  prettify: false,
  includeNewLine: true,
  logRequestId: true,
  logAllReqHeader: true,
  logAllResHeader: true,
});

const shouldTriggerBuild = {
  main: true,
  dev: true,
};

let requestsInQueue = {
  main: null,
  dev: null,
};

app.get("/confirm-build", async (req, res) => {
  const { ref } = req.query;

  if (
    ["main", "dev"].includes(ref) &&
    req.get("Build-Webhook-Secret") === process.env.BUILD_WEBHOOK_SECRET
  ) {
    shouldTriggerBuild[ref] = true;

    if (requestsInQueue[ref]) {
      await dispatchWorkflowRequest(
        res,
        ref,
        requestsInQueue[ref],
        shouldTriggerBuild,
        requestsInQueue
      );
    } else {
      res.send(
        JSON.stringify({
          message: "No build requests in queue",
        })
      );
    }
  } else {
    res.status(400);

    res.send(
      JSON.stringify({
        error: "Bad request",
      })
    );
  }
});

app.post("/rebuild-production-site", async (req, res) => {
  const { ref } = req.query,
    { event, model } = req.body;

  const build_id =
    event === "trigger-test"
      ? "Triggerred Manually"
      : event[6].toUpperCase() + event.slice(7) + " " + model;

  if (
    ["main", "dev"].includes(ref) &&
    req.get("Build-Webhook-Secret") === process.env.BUILD_WEBHOOK_SECRET
  ) {
    if (!shouldTriggerBuild[ref]) {
      res.status(429);

      if (
        Object.getOwnPropertyDescriptor(requestsInQueue, ref).writable === false
      ) {
        res.send(
          "Another build triggered by CMS update is already in progress. Wait 10 seconds before trying again."
        );
      } else {
        requestsInQueue[ref] = build_id;

        res.send(
          "Another build triggered by CMS update is already in progress. Next build will start automatically when the current one is finished."
        );
      }
    } else {
      await dispatchWorkflowRequest(
        res,
        ref,
        build_id,
        shouldTriggerBuild,
        requestsInQueue
      );
    }
  } else {
    res.status(400);

    res.send(
      JSON.stringify({
        error: "Bad request",
      })
    );
  }
});

app.post("/logpush", async (req, res) => {
  if (req.get("Logpush-Secret") === process.env.LOGPUSH_SECRET) {
    try {
      const body = await getRawBody(req),
        logs = zlib.unzipSync(body).toString();

      await Promise.all(
        logs
          .trimEnd()
          .split(/[\r\n]/)
          .map(async (log) => {
            const parsedLog = JSON.parse(log);

            const {
              EventTimestampMs,
              Outcome,
              ScriptName,
              Event: { RayID },
            } = parsedLog;

            const logDirectory = `/home/strapi/scripts/logs/${ScriptName}/${Outcome}`;

            const logFilePath = `${logDirectory}/${new Date(
              EventTimestampMs
            ).toISOString()}-${RayID}.json`;

            if (!fs.existsSync(logDirectory)) {
              await fs.promises.mkdir(logDirectory, { recursive: true });
            }

            await fs.promises.writeFile(logFilePath, log);
          })
      );

      res.send("OK");
    } catch (error) {
      console.log(error);

      res.status(500);
      res.send("Internal Server Error");
    }
  } else {
    res.status(401);
    res.send("Unauthorized");
  }
});

app.all("*", async (_, res) => {
  res.status(405);

  res.send(
    JSON.stringify({
      error: "Method or Path Not Allowed",
    })
  );
});

app.listen(PORT, () => {
  console.log("Listening on port", PORT);
});
