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

let light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(1, 1, 0), scene);

let mode = 'transform';
let labeledNodesList = {}; // Object to store labeled nodes
let labels = {};
let nodeMeshes = [];
let selectedNode = null; // Variable to store the currently selected node

// Custom modal elements
const customModal = document.getElementById('customModal');
const dropdownMenu = document.getElementById('nodeLabel');
customModal.style.display = 'none'; // Initially hidden

// Babylon.js GUI for Labels
let advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

function createLabel(node, text) {
    let label = new BABYLON.GUI.TextBlock();
    label.text = text;
    label.color = "red";
    label.fontSize = 14;  // Reduced font size to 14
    label.outlineWidth = 2;
    label.outlineColor = "black";
    
    let labelContainer = new BABYLON.GUI.Rectangle();
    labelContainer.width = "200px"; // Adjusted container width to 200px
    labelContainer.height = "20px"; // Adjusted container height to 20px
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

// Function to create the graph
function createGraph(data) {
    // Clear existing nodes and edges
    nodeMeshes = [];
    
    // Create Nodes
    data.nodes.forEach(nodeData => {
        let node = BABYLON.MeshBuilder.CreateSphere(`${nodeData.id}`, { diameter: 1 }, scene);
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
}

// Function to save labels as JSON with labelText included
function saveLabelsAsJSON() {
    const labeledNodes = [];

    // Collect labeled nodes and their labels
    for (let id in labeledNodesList) {
        labeledNodes.push({
            id: id,
            labelText: labeledNodesList[id],  // Save both id and labelText
        });
    }

    // Convert to JSON string
    const jsonString = JSON.stringify({ labeledNodes }, null, 2);

    // Create a Blob from the JSON string
    const blob = new Blob([jsonString], { type: "application/json" });

    // Create a link element to download the file
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "labeled_nodes.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);  // Clean up after download
}

// Function to reset labels
function resetLabels() {
    // Remove all labels from the labeledNodesList
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
}

// Event listener for "Save Labels" button
document.getElementById('saveButton').addEventListener('click', () => {
    saveLabelsAsJSON();  // Save the labels when the button is clicked
});

// Event listener for "Reset" button
document.getElementById('resetButton').addEventListener('click', () => {
    resetLabels();  // Reset all labels when the button is clicked
});

// Load default graph from graph_data.json
async function loadDefaultGraph() {
    try {
        const response = await fetch('graph_data.json');
        const data = await response.json();
        createGraph(data);
    } catch (error) {
        console.error("Error loading default graph:", error);
    }
}

// Handle uploaded file
function handleFileUpload(file) {
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            createGraph(data);
        } catch (error) {
            console.error("Invalid JSON format:", error);
            alert("The uploaded file is not a valid JSON file. Please try again.");
        }
    };
    reader.readAsText(file);
}

// Modal and upload elements
const uploadModal = document.getElementById('uploadModal');
const fileInput = document.getElementById('fileInput');
const cancelButton = document.getElementById('cancelButton');

// Event listener for file input
fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        handleFileUpload(file);
        uploadModal.style.display = 'none';  // Hide the modal after upload
    }
});

// Cancel button event listener: load default graph if the user cancels the upload
cancelButton.addEventListener('click', () => {
    uploadModal.style.display = 'none';  // Hide the modal
    loadDefaultGraph();  // Load the default graph from the JSON file
});

// Function to initialize the scene
function initializeScene() {
    // Show the upload modal when the website loads
    uploadModal.style.display = 'flex';
}

// Function to display the custom modal with the dropdown
function showCustomModal() {
    customModal.style.display = 'flex'; // Show custom modal
}

// Hide modal after setting the label
function hideCustomModal() {
    customModal.style.display = 'none'; // Hide custom modal
}

// Selection handler
function onSelectNode() {
    let pickResult = scene.pick(scene.pointerX, scene.pointerY);
    if (pickResult.hit && nodeMeshes.includes(pickResult.pickedMesh)) {
        selectedNode = pickResult.pickedMesh;  // Store the selected node
        showCustomModal();  // Show custom modal with dropdown
    }
}

// Set label button click event in the custom modal
document.getElementById('setLabelButton').addEventListener('click', () => {
    if (selectedNode) {
        let labelValue = document.getElementById('nodeLabel').value;
        let labelText = document.getElementById('nodeLabel').options[document.getElementById('nodeLabel').selectedIndex].text;

        if (labels[selectedNode.id]) {
            labels[selectedNode.id].labelPlane.dispose();
            labels[selectedNode.id].labelContainer.dispose();
        }

        // Create and store the new label
        let label = createLabel(selectedNode, labelText);
        labels[selectedNode.id] = label;
        labeledNodesList[selectedNode.id] = labelText;
        updateLabelList(selectedNode.id, labelText);

        selectedNode = null;  // Reset selected node after labeling
        hideCustomModal();  // Hide the custom modal after setting the label
    } else {
        alert("Please select a node first.");
    }
});

// Mode Switch Button
document.getElementById('modeButton').addEventListener('click', () => {
    if (mode === 'transform') {
        mode = 'select';
        document.getElementById('modeButton').innerText = 'Switch to Transform Mode';
        scene.onPointerDown = onSelectNode;  // Enable node selection
    } else {
        mode = 'transform';
        document.getElementById('modeButton').innerText = 'Switch to Selection Mode';
        scene.onPointerDown = null;  // Disable node selection
    }
});

// Resize event handler to keep canvas responsive
window.addEventListener('resize', () => {
    engine.resize();
});

// Initialize the scene and show the upload modal
initializeScene();
engine.runRenderLoop(() => {
    scene.render();
});


// // Babylon.js setup
// let canvas = document.createElement('canvas');
// canvas.id = "renderCanvas";
// document.body.appendChild(canvas);

// let engine = new BABYLON.Engine(canvas, true);
// let scene = new BABYLON.Scene(engine);

// // Set background to black
// scene.clearColor = new BABYLON.Color4(0, 0, 0, 1);

// let camera = new BABYLON.ArcRotateCamera("camera", Math.PI / 2, Math.PI / 4, 20, new BABYLON.Vector3(0, 0, 0), scene);
// camera.attachControl(canvas, true);

// let light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);

// let mode = 'transform';
// let labeledNodesList = {};
// let labels = {};
// let nodeMeshes = [];
// let selectedNode = null; // Variable to store the currently selected node

// // Custom modal elements
// const customModal = document.getElementById('customModal');
// const dropdownMenu = document.getElementById('nodeLabel');
// customModal.style.display = 'none'; // Initially hidden

// // Babylon.js GUI for Labels
// let advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

// function createLabel(node, text) {
//     let label = new BABYLON.GUI.TextBlock();
//     label.text = text;
//     label.color = "white";
//     label.fontSize = 14;
//     label.outlineWidth = 2;
//     label.outlineColor = "black";
    
//     let labelContainer = new BABYLON.GUI.Rectangle();
//     labelContainer.width = "200px";
//     labelContainer.height = "20px";
//     labelContainer.thickness = 0;
//     labelContainer.addControl(label);
    
//     let labelPlane = BABYLON.MeshBuilder.CreatePlane("labelPlane", { size: 2 }, scene);
//     labelPlane.position = node.position.clone();
    
//     advancedTexture.addControl(labelContainer);
//     labelContainer.linkWithMesh(labelPlane);
    
//     labelPlane.isPickable = false;
    
//     return { labelPlane, labelContainer };
// }

// function updateLabelList(nodeId, labelText) {
//     let listItem = document.createElement('li');
//     listItem.innerText = `Node ${nodeId}: ${labelText}`;
//     document.getElementById('labelList').appendChild(listItem);
// }

// // Function to create the graph
// function createGraph(data) {
//     // Clear existing nodes and edges
//     nodeMeshes = [];
    
//     // Create Nodes
//     data.nodes.forEach(nodeData => {
//         let node = BABYLON.MeshBuilder.CreateSphere(`${nodeData.id}`, { diameter: 1 }, scene);
//         node.position = new BABYLON.Vector3(nodeData.x, nodeData.y, nodeData.z);
//         nodeMeshes.push(node);
//     });

//     // Create Edges (Lines)
//     data.edges.forEach(edgeData => {
//         let fromNode = nodeMeshes[edgeData.from];
//         let toNode = nodeMeshes[edgeData.to];
//         BABYLON.MeshBuilder.CreateLines(`line${edgeData.from}-${edgeData.to}`, {
//             points: [fromNode.position, toNode.position]
//         }, scene);
//     });
// }

// // Load default graph from graph_data.json
// async function loadDefaultGraph() {
//     try {
//         const response = await fetch('graph_data.json');
//         const data = await response.json();
//         createGraph(data);
//     } catch (error) {
//         console.error("Error loading default graph:", error);
//     }
// }

// // Handle uploaded file
// function handleFileUpload(file) {
//     const reader = new FileReader();
//     reader.onload = (event) => {
//         try {
//             const data = JSON.parse(event.target.result);
//             createGraph(data);
//         } catch (error) {
//             console.error("Invalid JSON format:", error);
//             alert("The uploaded file is not a valid JSON file. Please try again.");
//         }
//     };
//     reader.readAsText(file);
// }

// // Modal and upload elements
// const uploadModal = document.getElementById('uploadModal');
// const fileInput = document.getElementById('fileInput');
// const cancelButton = document.getElementById('cancelButton');

// // Event listener for file input
// fileInput.addEventListener('change', (event) => {
//     const file = event.target.files[0];
//     if (file) {
//         handleFileUpload(file);
//         uploadModal.style.display = 'none';  // Hide the modal after upload
//     }
// });

// // Cancel button event listener: load default graph if the user cancels the upload
// cancelButton.addEventListener('click', () => {
//     uploadModal.style.display = 'none';  // Hide the modal
//     loadDefaultGraph();  // Load the default graph from the JSON file
// });

// // Function to initialize the scene
// function initializeScene() {
//     // Show the upload modal when the website loads
//     uploadModal.style.display = 'flex';
// }

// // Function to display the custom modal with the dropdown
// function showCustomModal() {
//     customModal.style.display = 'flex'; // Show custom modal
// }

// // Hide modal after setting the label
// function hideCustomModal() {
//     customModal.style.display = 'none'; // Hide custom modal
// }

// // Selection handler
// function onSelectNode() {
//     let pickResult = scene.pick(scene.pointerX, scene.pointerY);
//     if (pickResult.hit && nodeMeshes.includes(pickResult.pickedMesh)) {
//         selectedNode = pickResult.pickedMesh;  // Store the selected node
//         showCustomModal();  // Show custom modal with dropdown
//     }
// }

// // Set label button click event in the custom modal
// document.getElementById('setLabelButton').addEventListener('click', () => {
//     if (selectedNode) {
//         let labelValue = document.getElementById('nodeLabel').value;
//         let labelText = document.getElementById('nodeLabel').options[document.getElementById('nodeLabel').selectedIndex].text;

//         if (labels[selectedNode.id]) {
//             labels[selectedNode.id].labelPlane.dispose();
//             labels[selectedNode.id].labelContainer.dispose();
//         }

//         // Create and store the new label
//         let label = createLabel(selectedNode, labelText);
//         labels[selectedNode.id] = label;
//         labeledNodesList[selectedNode.id] = labelText;
//         updateLabelList(selectedNode.id, labelText);

//         selectedNode = null;  // Reset selected node after labeling
//         hideCustomModal();  // Hide the custom modal after setting the label
//     } else {
//         alert("Please select a node first.");
//     }
// });

// // Mode Switch Button
// document.getElementById('modeButton').addEventListener('click', () => {
//     if (mode === 'transform') {
//         mode = 'select';
//         document.getElementById('modeButton').innerText = 'Switch to Transform Mode';
//         scene.onPointerDown = onSelectNode;  // Enable node selection
//     } else {
//         mode = 'transform';
//         document.getElementById('modeButton').innerText = 'Switch to Selection Mode';
//         scene.onPointerDown = null;  // Disable node selection
//     }
// });

// // Resize event handler to keep canvas responsive
// window.addEventListener('resize', () => {
//     engine.resize();
// });

// // Initialize the scene and show the upload modal
// initializeScene();
// engine.runRenderLoop(() => {
//     scene.render();
// });

// // Babylon.js setup
// let canvas = document.createElement('canvas');
// canvas.id = "renderCanvas";
// document.body.appendChild(canvas);

// let engine = new BABYLON.Engine(canvas, true);
// let scene = new BABYLON.Scene(engine);

// // Set background to black
// scene.clearColor = new BABYLON.Color4(0, 0, 0, 1);

// let camera = new BABYLON.ArcRotateCamera("camera", Math.PI / 2, Math.PI / 4, 20, new BABYLON.Vector3(0, 0, 0), scene);
// camera.attachControl(canvas, true);

// let light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);

// let mode = 'transform';
// let labeledNodesList = {};
// let labels = {};
// let nodeMeshes = [];
// let selectedNode = null; // Variable to store the currently selected node

// // Babylon.js GUI for Labels
// let advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

// function createLabel(node, text) {
//     let label = new BABYLON.GUI.TextBlock();
//     label.text = text;
//     label.color = "white";
//     label.fontSize = 20;
//     label.outlineWidth = 2;
//     label.outlineColor = "black";
    
//     let labelContainer = new BABYLON.GUI.Rectangle();
//     labelContainer.width = "100px";
//     labelContainer.height = "40px";
//     labelContainer.thickness = 0;
//     labelContainer.addControl(label);
    
//     let labelPlane = BABYLON.MeshBuilder.CreatePlane("labelPlane", { size: 2 }, scene);
//     labelPlane.position = node.position.clone();
    
//     advancedTexture.addControl(labelContainer);
//     labelContainer.linkWithMesh(labelPlane);
    
//     labelPlane.isPickable = false;
    
//     return { labelPlane, labelContainer };
// }

// function updateLabelList(nodeId, labelText) {
//     let listItem = document.createElement('li');
//     listItem.innerText = `Node ${nodeId}: ${labelText}`;
//     document.getElementById('labelList').appendChild(listItem);
// }

// // Function to create the graph
// function createGraph(data) {
//     // Clear existing nodes and edges
//     nodeMeshes = [];
    
//     // Create Nodes
//     data.nodes.forEach(nodeData => {
//         let node = BABYLON.MeshBuilder.CreateSphere(`${nodeData.id}`, { diameter: 1 }, scene);
//         node.position = new BABYLON.Vector3(nodeData.x, nodeData.y, nodeData.z);
//         nodeMeshes.push(node);
//     });

//     // Create Edges (Lines)
//     data.edges.forEach(edgeData => {
//         let fromNode = nodeMeshes[edgeData.from];
//         let toNode = nodeMeshes[edgeData.to];
//         BABYLON.MeshBuilder.CreateLines(`line${edgeData.from}-${edgeData.to}`, {
//             points: [fromNode.position, toNode.position]
//         }, scene);
//     });
// }

// // Load default graph from graph_data.json
// async function loadDefaultGraph() {
//     try {
//         const response = await fetch('graph_data.json');
//         const data = await response.json();
//         createGraph(data);
//     } catch (error) {
//         console.error("Error loading default graph:", error);
//     }
// }

// // Handle uploaded file
// function handleFileUpload(file) {
//     const reader = new FileReader();
//     reader.onload = (event) => {
//         try {
//             const data = JSON.parse(event.target.result);
//             createGraph(data);
//         } catch (error) {
//             console.error("Invalid JSON format:", error);
//             alert("The uploaded file is not a valid JSON file. Please try again.");
//         }
//     };
//     reader.readAsText(file);
// }

// // Modal and upload elements
// const uploadModal = document.getElementById('uploadModal');
// const fileInput = document.getElementById('fileInput');
// const cancelButton = document.getElementById('cancelButton');

// // Event listener for file input
// fileInput.addEventListener('change', (event) => {
//     const file = event.target.files[0];
//     if (file) {
//         handleFileUpload(file);
//         uploadModal.style.display = 'none';  // Hide the modal after upload
//     }
// });

// // Cancel button event listener: load default graph if the user cancels the upload
// cancelButton.addEventListener('click', () => {
//     uploadModal.style.display = 'none';  // Hide the modal
//     loadDefaultGraph();  // Load the default graph from the JSON file
// });

// // Function to initialize the scene
// function initializeScene() {
//     // Show the upload modal when the website loads
//     uploadModal.style.display = 'flex';
// }

// // Selection handler
// function onSelectNode() {
//     let pickResult = scene.pick(scene.pointerX, scene.pointerY);
//     if (pickResult.hit && nodeMeshes.includes(pickResult.pickedMesh)) {
//         selectedNode = pickResult.pickedMesh;  // Store the selected node
//         alert("Node selected. Now choose a label from the dropdown and click 'Set Label'.");
//     }
// }

// // Set label button click event
// document.getElementById('setLabelButton').addEventListener('click', () => {
//     if (selectedNode) {
//         let labelValue = document.getElementById('nodeLabel').value;
//         let labelText = document.getElementById('nodeLabel').options[document.getElementById('nodeLabel').selectedIndex].text;

//         if (labels[selectedNode.id]) {
//             labels[selectedNode.id].labelPlane.dispose();
//             labels[selectedNode.id].labelContainer.dispose();
//         }

//         // Create and store the new label
//         let label = createLabel(selectedNode, labelText);
//         labels[selectedNode.id] = label;
//         labeledNodesList[selectedNode.id] = labelText;
//         updateLabelList(selectedNode.id, labelText);

//         selectedNode = null;  // Reset selected node after labeling
//     } else {
//         alert("Please select a node first.");
//     }
// });

// // Save Button Functionality: Save labels as a JSON file
// document.getElementById('saveButton').addEventListener('click', () => {
//     const labeledNodes = [];

//     // Collect labeled nodes and their labels
//     for (let id in labeledNodesList) {
//         labeledNodes.push({
//             id: id,
//             label: labeledNodesList[id]
//         });
//     }

//     // Convert to JSON string
//     const jsonString = JSON.stringify({ labeledNodes }, null, 2);

//     // Create a Blob from the JSON string
//     const blob = new Blob([jsonString], { type: "application/json" });

//     // Create a link element to download the file
//     const link = document.createElement("a");
//     link.href = URL.createObjectURL(blob);
//     link.download = "labeled_nodes.json";
//     document.body.appendChild(link);
//     link.click();
//     document.body.removeChild(link);  // Clean up after download
// });

// // Reset Button Functionality: Properly dispose labels and reset the state
// document.getElementById('resetButton').addEventListener('click', () => {
//     labeledNodesList = {};

//     // Dispose of all label planes and GUI elements
//     for (let id in labels) {
//         labels[id].labelPlane.dispose();
//         labels[id].labelContainer.dispose();
//     }

//     // Clear the labels dictionary
//     labels = {};

//     // Clear the label list in the UI
//     document.getElementById('labelList').innerHTML = '';
// });

// // Mode Switch Button
// document.getElementById('modeButton').addEventListener('click', () => {
//     if (mode === 'transform') {
//         mode = 'select';
//         document.getElementById('modeButton').innerText = 'Switch to Transform Mode';
//         scene.onPointerDown = onSelectNode;  // Enable node selection
//     } else {
//         mode = 'transform';
//         document.getElementById('modeButton').innerText = 'Switch to Selection Mode';
//         scene.onPointerDown = null;  // Disable node selection
//     }
// });

// // Resize event handler to keep canvas responsive
// window.addEventListener('resize', () => {
//     engine.resize();
// });

// // Initialize the scene and show the upload modal
// initializeScene();
// engine.runRenderLoop(() => {
//     scene.render();
// });
