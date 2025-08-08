// This imports the websocket support so that it can talk to the frontend in real time
const WebSocket = require('ws');
// This imports the wolrd model that holds beliefs
const WorldModel = require('./agent/WorldModel');
// This imports the plan generator that builds the plans to acieve the goal 
const { generatePlan } = require('./agent/PlanLibrary');
// The creates a websocket server that listens on port 8080
const wss = new WebSocket.Server({ port: 8080 });
// This is to create the initial world model of the belief state 
const worldModel = new WorldModel();
// Below is the to log the initila wolrd model of the belief states
console.log("🌍 Initial beliefs:", JSON.stringify(worldModel.getBeliefs(), null, 2));
console.log("✅ BDI agent server running on ws://localhost:8080");

// Below it handles new websocket connections 
wss.on('connection', (ws) => {
    console.log("🔌 Client connected");

    // Here it listens for messages from the frontend 

    ws.on('message', (message) => {
        try {
            const msg = JSON.parse(message);

            // This is to handle the reset of the environemnt
            if (msg.type === "reset") {
                worldModel.reset();
                console.log("🔄 World model reset.");
                return;
            }

            // Below it it is to update the belieffs from the frontend such as adding new blocks 
            if (msg.type === "update") {
                const beliefs = worldModel.getBeliefs();
                Object.assign(beliefs.blocks, msg.beliefs.blocks);
                console.log("🧠 Updated beliefs from client:", beliefs.blocks);
                return;
            }

            // This is to handle goal messages from the frontend like stacking A on B
            if (msg.type === "goal") {
                const goalStr = msg.goal;
                console.log("🎯 Received goal:", goalStr);

                const [block1, , block2] = goalStr.split(" ");
                const beliefs = worldModel.getBeliefs();

                // Below it prevents undefined blocks once that dontr exist in the world model and aborts and return an empty plan 
                if (!beliefs.blocks[block1] || !beliefs.blocks[block2]) {
                    console.log("⚠️ Block not found in beliefs:", block1, block2);
                    ws.send(JSON.stringify({ type: "plan", plan: [] }));
                    return;
                }

                // Here it generates a plan to achieve the goal and send it back to the client 

                const plan = generatePlan(beliefs, block1, block2);
                console.log("📦 Sending plan:", plan);
                ws.send(JSON.stringify({ type: "plan", plan }));
            }

        } catch (err) {

            // This is to catch any error while handling the mesasge
            console.error("❌ Error processing message:", err);
        }
    });
});
