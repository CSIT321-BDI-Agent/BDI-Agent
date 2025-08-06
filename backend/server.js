const WebSocket = require('ws');
const WorldModel = require('./agent/WorldModel');
const { generatePlan } = require('./agent/PlanLibrary');  // ✅ fixed

const wss = new WebSocket.Server({ port: 8080 });
const worldModel = new WorldModel();

console.log("🌍 Initial beliefs:", JSON.stringify(worldModel.getBeliefs(), null, 2));
console.log("✅ BDI agent server running on ws://localhost:8080");

wss.on('connection', (ws) => {
    console.log("🔌 Client connected");

    ws.on('message', (message) => {
        try {
            const msg = JSON.parse(message);

            if (msg.type === "reset") {
                worldModel.reset();
                console.log("🔄 World model reset.");
                return;
            }

            if (msg.type === "goal") {
                const goalStr = msg.goal;
                console.log("🎯 Received goal:", goalStr);

                const [block1, , block2] = goalStr.split(" ");
                const plan = generatePlan(worldModel.getBeliefs(), block1, block2);  // ✅ fixed

                console.log("📦 Sending plan:", plan);
                ws.send(JSON.stringify({ type: "plan", plan }));
            }

        } catch (err) {
            console.error("❌ Error processing message:", err);
        }
    });
});
