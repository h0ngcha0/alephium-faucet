const port = process.env.PORT ?? "8080";
const res = await fetch(`http://localhost:${port}/health`);
process.exit(res.ok ? 0 : 1);

export {};
