const socket = new WebSocket('ws://localhost:8080');

socket.onopen = () => {
    console.log('Connected to BDI agent');
    document.getElementById('status').innerHTML = "🟢 Connected to BDI agent.";
};

socket.onmessage = (event) => {
    try {
        const data = JSON.parse(event.data);
        if (data.type === "plan") {
            document.getElementById('status').innerHTML = "✅ Goal complete.";
            document.getElementById('log').innerHTML += `<br>📦 Plan received: ${formatPlan(data.plan)}`;
            animatePlan(data.plan);
        }
    } catch (e) {
        console.error("Failed to parse message:", e);
        document.getElementById('log').innerHTML += "<br>❌ Invalid message received.";
    }
};

socket.onerror = (err) => {
    console.error("WebSocket error:", err);
    document.getElementById('status').innerHTML = "🔴 WebSocket error occurred.";
};

socket.onclose = () => {
    document.getElementById('status').innerHTML = "🔌 Disconnected from BDI agent.";
};

document.getElementById('send-btn').addEventListener('click', () => {
    const goalInput = document.getElementById('goal-input').value.trim();
    if (!goalInput) {
        alert("⚠️ Please enter a valid goal like 'A on B'");
        return;
    }

    if (socket.readyState === WebSocket.OPEN) {
        const msg = { type: "goal", goal: goalInput };
        socket.send(JSON.stringify(msg));
        document.getElementById('log').innerHTML += `<br>🎯 Goal sent: ${goalInput}`;
    } else {
        document.getElementById('log').innerHTML += "<br>⚠️ WebSocket not connected.";
    }
});

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

function resetVisualBlocks() {
    const simArea = document.getElementById("simulation");
    const blocks = simArea.querySelectorAll(".block");
    blocks.forEach(block => {
        block.style.top = "";
        block.style.left = "";
    });
}

function formatPlan(plan) {
    return plan.map(step => step.join(" ")).join(" ➜ ");
}
