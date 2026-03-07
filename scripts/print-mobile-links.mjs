import os from "node:os";

const port = process.env.PORT || "3000";
const nets = os.networkInterfaces();
const candidates = [];

for (const [name, addrs] of Object.entries(nets)) {
  for (const addr of addrs || []) {
    if (addr.family !== "IPv4") continue;
    if (addr.internal) continue;
    const ip = String(addr.address || "").trim();
    if (!ip) continue;
    candidates.push({ name, ip });
  }
}

if (!candidates.length) {
  console.log("No external IPv4 addresses found.");
  console.log("Connect Mac and phone to same Wi-Fi, then run again.");
  process.exit(0);
}

console.log("Mobile test links (same local network):");
for (const item of candidates) {
  console.log(`\nInterface: ${item.name} (${item.ip})`);
  console.log(`- http://${item.ip}:${port}/`);
  console.log(`- http://${item.ip}:${port}/lagen.html`);
  console.log(`- http://${item.ip}:${port}/admin.html`);
}
