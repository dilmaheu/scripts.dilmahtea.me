// @ts-check

import * as dotenv from "dotenv";

dotenv.config({
  path: "/home/strapi/scripts/.env",
});

import { Octokit } from "@octokit/core";

const octokit = new Octokit({
  auth: process.env.GITHUB_PAT,
});

export default async function dispatchWorkflowRequest(
  res,
  ref,
  build_id,
  shouldTriggerBuild,
  requestsInQueue
) {
  try {
    shouldTriggerBuild[ref] = false;
    requestsInQueue[ref] = null;

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

    // Wait 10 seconds before allowing another build request
    Object.defineProperty(requestsInQueue, ref, { writable: false });

    setTimeout(() => {
      Object.defineProperty(requestsInQueue, ref, { writable: true });
    }, 1000 * 45);

    res.send("OK");
  } catch (error) {
    shouldTriggerBuild[ref] = true;

    res.status(500);

    res.send(
      JSON.stringify({
        error: error.message,
      })
    );
  }
}
