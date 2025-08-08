// This here establishers the connection to the BDI agent backend
const socket = new WebSocket('ws://localhost:8080');
// This is for when the connection opes successfully 
socket.onopen = () => {
    console.log('Connected to BDI agent');
    document.getElementById('status').innerHTML = "🟢 Connected to BDI agent.";
};
// Below the code handles incoming messages from the server mainly the plans
socket.onmessage = (event) => {
    try {
        const data = JSON.parse(event.data);
        if (data.type === "plan") {
            document.getElementById('status').innerHTML = "✅ Goal complete.";
            document.getElementById('log').innerHTML += `<br>📦 Plan received: ${formatPlan(data.plan)}`;
            animatePlan(data.plan);
        }
    } catch (e) {
        // handles issue with json
        console.error("Failed to parse message:", e);
        document.getElementById('log').innerHTML += "<br>❌ Invalid message received.";
    }
};
// Below it handles any connection errors
socket.onerror = (err) => {
    console.error("WebSocket error:", err);
    document.getElementById('status').innerHTML = "🔴 WebSocket error occurred.";
};
// Handles any disconects from the server
socket.onclose = () => {
    document.getElementById('status').innerHTML = "🔌 Disconnected from BDI agent.";
};
// This is for when the user clicks the send goal button 
document.getElementById('send-btn').addEventListener('click', () => {
    const goalInput = document.getElementById('goal-input').value.trim();
    // Checks for valid input through the format
    if (!goalInput) {
        alert("⚠️ Please enter a valid goal like 'A on B'");
        return;
    }

    // Only sends if the websocket is conencted 

    if (socket.readyState === WebSocket.OPEN) {
        const msg = { type: "goal", goal: goalInput };
        socket.send(JSON.stringify(msg));
        document.getElementById('log').innerHTML += `<br>🎯 Goal sent: ${goalInput}`;
    } else {
        document.getElementById('log').innerHTML += "<br>⚠️ WebSocket not connected.";
    }
});
// Below code is for the reset button to reset the state back to the start
document.getElementById('reset-btn').addEventListener('click', () => {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "reset" }));
        document.getElementById('status').innerHTML = "✅ Beliefs reset.";
        document.getElementById('log').innerHTML += "<br>🔄 Reset sent.";
        resetVisualBlocks();
    } else {
        document.getElementById('log').innerHTML += "<br>⚠️ Cannot reset: WebSocket not connected.";
    }
});
// This displays each plan with basic animation and log feedback
function animatePlan(plan) {
    console.log("🎬 Executing plan:", plan);
    
    plan.forEach((step, index) => {
        const stepStr = step.join(" ");
        setTimeout(() => {
            console.log(`⏱️ Step ${index + 1}: ${stepStr}`);
            document.getElementById('log').innerHTML += `<br>🛠️ Step ${index + 1}: ${stepStr}`;
        }, index * 1000);
    });
}
// This resets the blovks in the simulation area
function resetVisualBlocks() {
    const simArea = document.getElementById("simulation");
    const blocks = simArea.querySelectorAll(".block");
    blocks.forEach(block => {
        block.style.top = "";
        block.style.left = "";
    });
}
// Belwo it converts a plan array into redable string format
function formatPlan(plan) {
    return plan.map(step => step.join(" ")).join(" ➜ ");
}
