// @ts-check

import * as dotenv from "dotenv";

dotenv.config({
  path: "/home/strapi/scripts/.env",
});

import express from "express";
import morganBody from "morgan-body";
import dispatchWorkflowRequest from "./utils/dispatchWorkflowRequest.js";

const app = express(),
  PORT = 4000;

app.use(express.json());

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
        shouldTriggerBuild
      );

      requestsInQueue[ref] = null;

      res.send(
        JSON.stringify({
          message: "Triggered build request in queue",
        })
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
      requestsInQueue[ref] = build_id;

      res.status(429);

      res.send(
        "Another build triggered by CMS update is already in progress. Next build will start automatically when the current one is finished."
      );
    } else {
      await dispatchWorkflowRequest(res, ref, build_id, shouldTriggerBuild);
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

app.all("*", async (_, res) => {
  res.send(
    JSON.stringify({
      error: "Method or Path Not Allowed",
    })
  );
});

app.listen(PORT, () => {
  console.log("Listening on port", PORT);
});
