const WebSocket = require('ws');
const WorldModel = require('./agent/WorldModel');
const { generatePlan } = require('./agent/PlanLibrary');

const wss = new WebSocket.Server({ port: 8080 });
const worldModel = new WorldModel();

console.log("🌍 Initial beliefs:", JSON.stringify(worldModel.getBeliefs(), null, 2));
console.log("✅ BDI agent server running on ws://localhost:8080");

wss.on('connection', (ws) => {
    console.log("🔌 Client connected");

    ws.on('message', (message) => {
        try {
            const msg = JSON.parse(message);

            // 🔁 Handle environment reset
            if (msg.type === "reset") {
                worldModel.reset();
                console.log("🔄 World model reset.");
                return;
            }

            // 🧠 Handle frontend belief updates (new blocks added)
            if (msg.type === "update") {
                const beliefs = worldModel.getBeliefs();
                Object.assign(beliefs.blocks, msg.beliefs.blocks);
                console.log("🧠 Updated beliefs from client:", beliefs.blocks);
                return;
            }

            // 🎯 Handle goal messages
            if (msg.type === "goal") {
                const goalStr = msg.goal;
                console.log("🎯 Received goal:", goalStr);

                const [block1, , block2] = goalStr.split(" ");
                const beliefs = worldModel.getBeliefs();

                // Prevent undefined blocks
                if (!beliefs.blocks[block1] || !beliefs.blocks[block2]) {
                    console.log("⚠️ Block not found in beliefs:", block1, block2);
                    ws.send(JSON.stringify({ type: "plan", plan: [] }));
                    return;
                }

                const plan = generatePlan(beliefs, block1, block2);
                console.log("📦 Sending plan:", plan);
                ws.send(JSON.stringify({ type: "plan", plan }));
            }

        } catch (err) {
            console.error("❌ Error processing message:", err);
        }
    });
});
