// How to handle "double-texting" or concurrent runs in your graph

/* 
You might want to start a new run on a thread while the previous run still haven't finished. We call this "double-texting" or multi-tasking.

There are several strategies for handling this:
 
- `reject`: Reject the new run
- `cancel`: Cancel the existing run and start a new one.
- `enqueue`: Wait until the existing run is finished to start the new run.
*/

import { Client } from "@langchain/langgraph-sdk";

const sleep = async (ms: number) =>
  await new Promise((resolve) => setTimeout(resolve, ms));

const pollRun = async (client: Client, threadId: string, runId: string) => {
  // Wait until the original run finishes
  let run = await client.runs.get(threadId, runId);
  while (run["status"] != "success") {
    await sleep(500);
    run = await client.runs.get(threadId, runId);
  }
  return run;
};

async function main() {
  const client = new Client();
  const assistant = await client.assistants.create({
    graphId: "agent",
  });

  // REJECT
  console.log("\nREJECT demo\n");
  let thread = await client.threads.create();
  let run = await client.runs.create(
    thread["thread_id"],
    assistant["assistant_id"],
    {
      input: {
        messages: [{ role: "human", content: "whats the weather in sf?" }],
      },
    },
  );

  // attempt a new run (will be rejected)
  await client.runs.create(thread["thread_id"], assistant["assistant_id"], {
    input: {
      messages: [{ role: "human", content: "whats the weather in nyc?" }],
    },
    multitaskStrategy: "reject",
  });

  run = await pollRun(client, thread["thread_id"], run["run_id"]);

  // We can verify that the original thread finished executing:
  let state = await client.threads.getState(thread["thread_id"]);
  console.log("Messages", state["values"]["messages"]);

  // INTERRUPT
  console.log("\nINTERRUPT demo\n");
  thread = await client.threads.create();
  const interruptedRun = await client.runs.create(
    thread["thread_id"],
    assistant["assistant_id"],
    {
      input: {
        messages: [{ role: "human", content: "whats the weather in sf?" }],
        sleep: 5,
      },
    },
  );
  await sleep(500);
  run = await client.runs.create(
    thread["thread_id"],
    assistant["assistant_id"],
    {
      input: {
        messages: [{ role: "human", content: "whats the weather in nyc?" }],
      },
      multitaskStrategy: "interrupt",
    },
  );
  run = await pollRun(client, thread["thread_id"], run["run_id"]);

  // We can see that the thread has partial data from the first run + data from the second run
  state = await client.threads.getState(thread["thread_id"]);
  console.log("Messages", state["values"]["messages"]);

  // Verify that the original, canceled run was interrupted
  console.log(
    "Interrupted run status",
    (await client.runs.get(thread["thread_id"], interruptedRun["run_id"]))[
      "status"
    ],
  );

  // ROLLBACK
  console.log("\nROLLBACK demo\n");
  thread = await client.threads.create();
  const rolledBackRun = await client.runs.create(
    thread["thread_id"],
    assistant["assistant_id"],
    {
      input: {
        messages: [{ role: "human", content: "whats the weather in sf?" }],
        sleep: 5,
      },
    },
  );
  await sleep(500);
  run = await client.runs.create(
    thread["thread_id"],
    assistant["assistant_id"],
    {
      input: {
        messages: [{ role: "human", content: "whats the weather in nyc?" }],
      },
      multitaskStrategy: "rollback",
    },
  );

  await pollRun(client, thread["thread_id"], run["run_id"]);

  // We can see that the thread only has data from the second run
  state = await client.threads.getState(thread["thread_id"]);
  console.log("Messages", state["values"]["messages"]);

  // Verify that the original, rolled back run was deleted
  try {
    await client.runs.get(thread["thread_id"], rolledBackRun["run_id"]);
  } catch (e) {
    console.log("Original run was deleted", e);
  }

  // ENQUEUE
  console.log("\nENQUEUE demo\n");
  thread = await client.threads.create();
  await client.runs.create(thread["thread_id"], assistant["assistant_id"], {
    input: {
      messages: [{ role: "human", content: "whats the weather in sf?" }],
      sleep: 5,
    },
  });
  await sleep(500);
  const secondRun = await client.runs.create(
    thread["thread_id"],
    assistant["assistant_id"],
    {
      input: {
        messages: [{ role: "human", content: "whats the weather in nyc?" }],
      },
      multitaskStrategy: "enqueue",
    },
  );
  await pollRun(client, thread["thread_id"], secondRun["run_id"]);

  // Verify that the thread has data from both runs
  state = await client.threads.getState(thread["thread_id"]);
  console.log("Combined messages", state["values"]["messages"]);
}

main();
