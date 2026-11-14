import { createPublicClient, http, formatEther } from "viem";
const pc = createPublicClient({ transport: http("https://api.hideki2.infra.testnet.somnia.network") });
for (const a of ["0x86f95901932352e0f25B6c4807268334D97c065C","0x0F095219812512018b2A071200Da256bEA984CAE"]) console.log(a, formatEther(await pc.getBalance({ address: a as any })));
