import autocannon from "autocannon";

const url = process.env.LOAD_TEST_URL ?? "http://127.0.0.1:4000/api/health";
const connections = Number(process.env.LOAD_TEST_CONNECTIONS ?? 20);
const duration = Number(process.env.LOAD_TEST_DURATION ?? 10);
const pipelining = Number(process.env.LOAD_TEST_PIPELINING ?? 1);

function formatLatency(value?: number | null) {
  if (!value || Number.isNaN(value)) {
    return "n/a";
  }

  return `${value.toFixed(2)} ms`;
}

async function main() {
  const result = await autocannon({
    url,
    connections,
    duration,
    pipelining,
    method: "GET",
  });

  console.log(`Load test target: ${url}`);
  console.log(`Connections: ${connections}`);
  console.log(`Duration: ${duration}s`);
  console.log(`Pipelining: ${pipelining}`);
  console.log(`Requests/sec avg: ${result.requests.average.toFixed(2)}`);
  console.log(`Requests/sec max: ${result.requests.max}`);
  console.log(`Latency p50: ${formatLatency(result.latency.p50)}`);
  console.log(`Latency p97.5: ${formatLatency(result.latency.p97_5)}`);
  console.log(`Latency avg: ${formatLatency(result.latency.average)}`);
  console.log(`Throughput avg: ${result.throughput.average.toFixed(2)} bytes/sec`);
  console.log(`Non-2xx responses: ${result.non2xx}`);
  console.log(`Errors: ${result.errors}`);
  console.log(`Timeouts: ${result.timeouts}`);

  if (result.errors > 0 || result.timeouts > 0 || result.non2xx > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
