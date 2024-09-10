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
    return labelPlane;
}

function updateLabelList(nodeId, labelText) {
    let listItem = document.createElement('li');
    listItem.innerText = `Node ${nodeId}: ${labelText}`;
    document.getElementById('labelList').appendChild(listItem);
}

// Create Nodes and Edges
function createGraph() {
    for (let i = 0; i < 10; i++) {
        let node = BABYLON.MeshBuilder.CreateSphere(`node${i}`, { diameter: 1 }, scene);
        node.position = new BABYLON.Vector3(Math.random() * 10 - 5, Math.random() * 10 - 5, Math.random() * 10 - 5);
        nodeMeshes.push(node);
    }

    // Create dummy edges for now
    for (let i = 0; i < 9; i++) {
        let line = BABYLON.MeshBuilder.CreateLines(`line${i}`, {
            points: [nodeMeshes[i].position, nodeMeshes[i + 1].position]
        }, scene);
    }
}

// Selection handler
function onSelectNode() {
    let pickResult = scene.pick(scene.pointerX, scene.pointerY);
    if (pickResult.hit && nodeMeshes.includes(pickResult.pickedMesh)) {
        let clickedNode = pickResult.pickedMesh;
        let labelText = prompt("Enter label for this node:");

        if (labelText) {
            let labelPlane = createLabel(clickedNode, labelText);
            labels[clickedNode.id] = labelPlane;
            labeledNodesList[clickedNode.id] = labelText;
            updateLabelList(clickedNode.id, labelText);
        }
    }
}

// Mode and Reset Buttons
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

document.getElementById('resetButton').addEventListener('click', () => {
    labeledNodesList = {};
    for (let id in labels) {
        labels[id].dispose();
    }
    document.getElementById('labelList').innerHTML = '';
});

// Resize event handler to keep canvas responsive
window.addEventListener('resize', () => {
    engine.resize();
});

// Create graph and start rendering
createGraph();
engine.runRenderLoop(() => {
    scene.render();
});
