// Babylon.js setup
let canvas = document.createElement('canvas');
canvas.id = "renderCanvas";
document.body.appendChild(canvas);

let engine = new BABYLON.Engine(canvas, true);
let scene = new BABYLON.Scene(engine);

// Set background to black
scene.clearColor = new BABYLON.Color4(0, 0, 0, 1);

let camera = new BABYLON.ArcRotateCamera("camera", Math.PI / 2, Math.PI / 4, 20, new BABYLON.Vector3(0, 0, 0), scene);
camera.attachControl(canvas, true);
let light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);

let mode = 'transform';
let labeledNodesList = {};
let labels = {};
let nodeMeshes = [];

// Babylon.js GUI for Labels
let advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

function createLabel(node, text) {
    let label = new BABYLON.GUI.TextBlock();
    label.text = text;
    label.color = "white";
    label.fontSize = 20;
    label.outlineWidth = 2;
    label.outlineColor = "black";
    
    let labelContainer = new BABYLON.GUI.Rectangle();
    labelContainer.width = "100px";
    labelContainer.height = "40px";
    labelContainer.thickness = 0;
    labelContainer.addControl(label);
    
    let labelPlane = BABYLON.MeshBuilder.CreatePlane("labelPlane", { size: 2 }, scene);
    labelPlane.position = node.position.clone();
    advancedTexture.addControl(labelContainer);
    
    labelContainer.linkWithMesh(labelPlane);
    labelPlane.isPickable = false;
    return { labelPlane, labelContainer };
}

function updateLabelList(nodeId, labelText) {
    let listItem = document.createElement('li');
    listItem.innerText = `Node ${nodeId}: ${labelText}`;
    document.getElementById('labelList').appendChild(listItem);
}

// Function to load the graph data from the JSON file
async function loadGraphData() {
    try {
        const response = await fetch('graph_data.json');
        const data = await response.json();

        // Create Nodes
        data.nodes.forEach(nodeData => {
            let node = BABYLON.MeshBuilder.CreateSphere(`node${nodeData.id}`, { diameter: 1 }, scene);
            node.position = new BABYLON.Vector3(nodeData.x, nodeData.y, nodeData.z);
            nodeMeshes.push(node);
        });

        // Create Edges (Lines)
        data.edges.forEach(edgeData => {
            let fromNode = nodeMeshes[edgeData.from];
            let toNode = nodeMeshes[edgeData.to];
            BABYLON.MeshBuilder.CreateLines(`line${edgeData.from}-${edgeData.to}`, {
                points: [fromNode.position, toNode.position]
            }, scene);
        });
    } catch (error) {
        console.error("Error loading graph data:", error);
    }
}

// Selection handler
function onSelectNode() {
    let pickResult = scene.pick(scene.pointerX, scene.pointerY);
    if (pickResult.hit && nodeMeshes.includes(pickResult.pickedMesh)) {
        let clickedNode = pickResult.pickedMesh;
        let labelText = prompt("Enter label for this node:");

        if (labelText) {
            if (labels[clickedNode.id]) {
                labels[clickedNode.id].labelPlane.dispose();
                labels[clickedNode.id].labelContainer.dispose();
            }

            // Create and store the new label
            let label = createLabel(clickedNode, labelText);
            labels[clickedNode.id] = label;
            labeledNodesList[clickedNode.id] = labelText;
            updateLabelList(clickedNode.id, labelText);
        }
    }
}

// Reset Button Functionality: Properly dispose labels and reset the state
document.getElementById('resetButton').addEventListener('click', () => {
    labeledNodesList = {};

    // Dispose of all label planes and GUI elements
    for (let id in labels) {
        labels[id].labelPlane.dispose();
        labels[id].labelContainer.dispose();
    }

    // Clear the labels dictionary
    labels = {};

    // Clear the label list in the UI
    document.getElementById('labelList').innerHTML = '';
});

// Mode Switch Button
document.getElementById('modeButton').addEventListener('click', () => {
    if (mode === 'transform') {
        mode = 'select';
        document.getElementById('modeButton').innerText = 'Switch to Transform Mode';
        scene.onPointerDown = onSelectNode;
    } else {
        mode = 'transform';
        document.getElementById('modeButton').innerText = 'Switch to Selection Mode';
        scene.onPointerDown = null;
    }
});

// Resize event handler to keep canvas responsive
window.addEventListener('resize', () => {
    engine.resize();
});

// Load graph data and start rendering
loadGraphData();
engine.runRenderLoop(() => {
    scene.render();
});
