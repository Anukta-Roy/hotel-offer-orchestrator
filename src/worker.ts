import { NativeConnection, Worker } from "@temporalio/worker";
import * as hotelActivities from "./activities/hotels";
import { config } from "./config";

async function run() {
  const connection = await NativeConnection.connect({ address: config.temporalAddress });
  const worker = await Worker.create({
    connection,
    namespace: config.temporalNamespace,
    taskQueue: config.taskQueue,
    workflowsPath: require.resolve("./workflows/hotelWorkflow"),
    activities: hotelActivities
  });
  console.log(`Temporal worker listening on ${config.taskQueue}`);
  await worker.run();
}
run().catch((error) => {
  console.error("Worker failed", error);
  process.exit(1);
});
