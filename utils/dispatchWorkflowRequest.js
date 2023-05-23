// @ts-check

import { Octokit } from "@octokit/core";

const octokit = new Octokit({
  auth: process.env.GITHUB_PAT,
});

export default async function dispatchWorkflowRequest(
  res,
  ref,
  build_id,
  shouldTriggerBuild
) {
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
