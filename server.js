const WebSocket = require('ws');
const WorldModel = require('./agent/WorldModel');
const BdiAgent = require('./agent/BdiAgent');

const PORT = process.env.PORT || 8080;

// Initialize BDI components
const worldModel = new WorldModel();
const bdiAgent = new BdiAgent(worldModel);

const wss = new WebSocket.Server({ port: PORT });

console.log("🌍 Initial beliefs:", JSON.stringify(worldModel.getBeliefs(), null, 2));
console.log(`✅ BDI agent server running on ws://localhost:${PORT}`);

wss.on('connection', (ws) => {
    console.log("🔌 Client connected");
    
    // Send initial state to client
    ws.send(JSON.stringify({
        type: "state",
        beliefs: worldModel.getBeliefs(),
        description: worldModel.getStateDescription()
    }));

    ws.on('message', (message) => {
        try {
            const msg = JSON.parse(message);
            console.log("📨 Received message:", msg);

            switch (msg.type) {
                case "reset":
                    worldModel.reset();
                    ws.send(JSON.stringify({
                        type: "reset_complete",
                        beliefs: worldModel.getBeliefs(),
                        description: worldModel.getStateDescription()
                    }));
                    break;

                case "goal":
                    handleGoal(ws, msg.goal);
                    break;

                case "execute_action":
                    handleExecuteAction(ws, msg.action);
                    break;

                default:
                    ws.send(JSON.stringify({
                        type: "error",
                        message: `Unknown message type: ${msg.type}`
                    }));
            }
        } catch (err) {
            console.error("❌ Error processing message:", err);
            ws.send(JSON.stringify({
                type: "error",
                message: "Invalid message format"
            }));
        }
    });

    ws.on('close', () => {
        console.log("🔌 Client disconnected");
    });

    ws.on('error', (error) => {
        console.error("❌ WebSocket error:", error);
    });
});

function handleGoal(ws, goalStr) {
    if (!goalStr || typeof goalStr !== 'string') {
        ws.send(JSON.stringify({
            type: "error",
            message: "Invalid goal format"
        }));
        return;
    }

    console.log("🎯 Processing goal:", goalStr);
    
    // Use BDI agent to deliberate and generate plan
    const plan = bdiAgent.deliberate(goalStr);
    
    ws.send(JSON.stringify({
        type: "plan",
        goal: goalStr,
        plan: plan,
        current_state: worldModel.getStateDescription()
    }));
}

function handleExecuteAction(ws, action) {
    if (!action || !Array.isArray(action)) {
        ws.send(JSON.stringify({
            type: "error",
            message: "Invalid action format"
        }));
        return;
    }

    console.log("⚡ Executing action:", action);
    const success = worldModel.executeAction(action);
    
    ws.send(JSON.stringify({
        type: "action_result",
        action: action,
        success: success,
        beliefs: worldModel.getBeliefs(),
        description: worldModel.getStateDescription()
    }));
}

wss.on('error', (error) => {
    console.error("❌ Server error:", error);
});

process.on('SIGINT', () => {
    console.log("\n🛑 Shutting down server...");
    wss.close(() => {
        console.log("✅ Server closed");
        process.exit(0);
    });
});
