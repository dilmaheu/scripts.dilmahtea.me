import * as dotenv from "dotenv";

dotenv.config({
  path: "/home/strapi/scripts/.env",
});

import express from "express";
import morganBody from "morgan-body";
import { Octokit } from "@octokit/core";

const octokit = new Octokit({
  auth: process.env.GITHUB_PAT,
});

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

app.post("/rebuild-production-site", async (req, res) => {
  const { ref } = req.query,
    { event, model } = req.body;

  const build_id =
    event === "trigger-test"
      ? "Triggerred Manually"
      : event[6].toUpperCase() + event.slice(7) + " " + model;

  if (
    ["main", "dev"].includes(ref) &&
    req.get("Strapi-Webhook-Secret") === process.env.STRAPI_WEBHOOK_SECRET
  ) {
    if (!shouldTriggerBuild[ref]) {
      res.status(429);

      res.send(
        "Rebuilding of the same branch is not allowed within 10 seconds"
      );
    } else {
      try {
        await octokit.request(
          "POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches",
          {
            owner: "dilmaheu",
            repo: "dilmahtea.me",
            workflow_id: "deploy.yml",
            ref,
            headers: {
              "X-GitHub-Api-Version": "2022-11-28",
            },
            inputs: {
              build_id,
            },
          }
        );

        shouldTriggerBuild[ref] = false;

        // allow rebuilding the same branch after 10 seconds
        setTimeout(() => {
          shouldTriggerBuild[ref] = true;
        }, 10000);

        res.send("OK");
      } catch (error) {
        res.status(500);

        res.send(
          JSON.stringify({
            error: error.message,
          })
        );
      }
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
