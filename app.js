

// Babylon.js setup
let canvas = document.createElement('canvas');
canvas.id = "renderCanvas";
document.body.appendChild(canvas);

let engine = new BABYLON.Engine(canvas, true);
let scene = new BABYLON.Scene(engine);

// Set background to black
scene.clearColor = new BABYLON.Color4(0, 0, 0, 1);

// Create camera
let camera = new BABYLON.ArcRotateCamera("camera", Math.PI / 2, 50,  Math.PI / 4, new BABYLON.Vector3(0, 0, 0), scene);
camera.attachControl(canvas, true);

// Create light (changed light to come from the opposite side)
let light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, -1, 0), scene);

// Variables for labeling
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
    label.color = "white";
    label.fontSize = 14;  // Reduced font size to 14
    label.outlineWidth = 2;
    label.outlineColor = "black";
    
    let labelContainer = new BABYLON.GUI.Rectangle();
    labelContainer.width = "200px"; // Adjusted container width to 200px
    labelContainer.height = "20px"; // Adjusted container height to 20px
    labelContainer.thickness = 0;
    labelContainer.background = "rgba(0, 0, 0, 0.5)"; // Optional: semi-transparent background
    labelContainer.addControl(label);
    
    let labelPlane = BABYLON.MeshBuilder.CreatePlane("labelPlane", { size: 2 }, scene);
    labelPlane.position = node.position.clone();
    labelPlane.position.y += 1.5; // Position label above the node
    
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
        let node = BABYLON.MeshBuilder.CreateSphere(`${nodeData.id}`, { diameter: 6 }, scene);
        node.position = new BABYLON.Vector3(nodeData.x, nodeData.y, nodeData.z);
        nodeMeshes.push(node);
    });


    // Create Edges (Lines)
    data.edges.forEach(edgeData => {
    let fromNode = nodeMeshes[edgeData.from];
    let toNode = nodeMeshes[edgeData.to];

    // Create a line between nodes
    let line = BABYLON.MeshBuilder.CreateLines(`line${edgeData.from}-${edgeData.to}`, {
        points: [fromNode.position, toNode.position],
        updatable: false
    }, scene);

    // Set the line color directly using the .color property
    line.color = new BABYLON.Color3(0, 1, 0);  // Set the line color (green in this case)
});
}




//new function from chatgpt-
// Get references to the new load button and hidden file input
const loadButton = document.getElementById('loadButton');
const labelFileInput = document.getElementById('labelFileInput');

// Event listener to trigger file input when "Load Labels" button is clicked
// loadButton.addEventListener('click', () => {
//     labelFileInput.click();  // Trigger file input dialog
// });

// Add both click and touch event listeners to the button
loadButton.addEventListener('click', () => {
    labelFileInput.click();  // Trigger file input dialog
});

loadButton.addEventListener('touchend', () => {
    labelFileInput.click();  // Trigger file input dialog
});


// Event listener for handling the uploaded file
labelFileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                loadLabelsFromJSON(data);  // Apply the labels to the nodes
            } catch (error) {
                console.error("Error parsing JSON file:", error);
                alert("Invalid JSON file format.");
            }
        };
        reader.readAsText(file);
    }
});

//test chatgpt function for updating the available list of variables when loading some predone labels
function loadLabelsFromJSON(data) {
    console.log("Loading labels from JSON:", data);

    data.labeledNodes.forEach(labeledNode => {
        const nodeId = labeledNode.id;
        const labelText = labeledNode.labelText;

        // Find the node by id in the existing nodeMeshes array
        const node = nodeMeshes.find(n => n.id === String(nodeId));
        if (node) {
            console.log(`Found node ${nodeId}, applying label: ${labelText}`);

            // Create the label for the node
            let label = createLabel(node, labelText);
            labels[nodeId] = label;
            labeledNodesList[nodeId] = labelText;

            // Update the usedLabels set and remove from availableLabels
            usedLabels.add(labelText);

            // Remove the label from availableLabels if it's used
            const labelIndex = availableLabels.indexOf(labelText);
            if (labelIndex !== -1) {
                availableLabels.splice(labelIndex, 1); // Remove the label from availableLabels
            }

            // Update the label list in the UI
            updateLabelList(nodeId, labelText);
        } else {
            console.error(`Node ${nodeId} not found!`);
        }
    });
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

// Add an event listener to adjust node sizes via the slider
const nodeSizeSlider = document.getElementById('nodeSizeSlider');
nodeSizeSlider.addEventListener('input', (event) => {
    let newDiameter = parseFloat(event.target.value);

    nodeMeshes.forEach(node => {
        node.scaling = new BABYLON.Vector3(newDiameter / 6, newDiameter / 6, newDiameter / 6);
    });
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
// Function to change the color of the selected node
function changeNodeColor(node, color) {
    if (!node.material) {
        node.material = new BABYLON.StandardMaterial(`mat-${node.id}`, scene);
    }
    node.material.diffuseColor = color;
}


// Selection handler
let previouslySelectedNode = null;

function onSelectNode() {
    let pickResult = scene.pick(scene.pointerX, scene.pointerY);
    if (pickResult.hit && nodeMeshes.includes(pickResult.pickedMesh)) {
        selectedNode = pickResult.pickedMesh;  // Store the newly selected node

        // Reset the color of the previously selected node
        if (previouslySelectedNode && previouslySelectedNode !== selectedNode) {
            changeNodeColor(previouslySelectedNode, previouslySelectedNode.originalColor || new BABYLON.Color3(1, 1, 1));  // Default back to white if no original color
        }

        // Save the original color if it hasn't been saved yet
        if (!selectedNode.originalColor) {
            selectedNode.originalColor = selectedNode.material ? selectedNode.material.diffuseColor : new BABYLON.Color3(1, 1, 1); // Default to white
        }

        // Change the color of the selected node to indicate selection
        changeNodeColor(selectedNode, new BABYLON.Color3(1, 0, 0));  // Set to red for selection

        // Store this node as the previously selected node for future resets
        previouslySelectedNode = selectedNode;

        // Check if the node is already labeled
        if (labeledNodesList[selectedNode.id]) {
            // Ask the user if they want to relabel the node, including the node ID in the message
            let confirmRelabel = confirm(`Node ID# ${selectedNode.id} is already labeled. Do you want to relabel it?`);
            if (confirmRelabel) {
                // Remove the previous label before relabeling
                labels[selectedNode.id].labelPlane.dispose();
                labels[selectedNode.id].labelContainer.dispose();
                delete labels[selectedNode.id];  // Remove the label from the labels dictionary
                
                // Also remove the previous label from the UI list
                removeLabelFromUI(selectedNode.id);
                
                showCustomModal();  // Show custom modal to relabel
            }
        } else {
            showCustomModal();  // Show custom modal with dropdown if not labeled yet
        }
    }
}


function removeLabelFromUI(nodeId) {
    let labelList = document.getElementById('labelList');
    let items = labelList.getElementsByTagName('li');
    for (let i = 0; i < items.length; i++) {
        if (items[i].innerText.startsWith(`Node ${nodeId}:`)) {
            labelList.removeChild(items[i]);  // Remove the list item for the node
            break;
        }
    }
}


document.getElementById('setLabelButton').addEventListener('click', () => {
    if (selectedNode) {
        let labelValue = document.getElementById('nodeLabel').value;
        let labelText = document.getElementById('nodeLabel').options[document.getElementById('nodeLabel').selectedIndex].text;

        // If the label is "Undefined"
        if (labelText === "Undefined") {
            // Remove the label if it exists
            if (labels[selectedNode.id]) {
                labels[selectedNode.id].labelPlane.dispose();
                labels[selectedNode.id].labelContainer.dispose();
                delete labels[selectedNode.id]; // Remove from the labels dictionary
            }

            // Remove from the labeled]NodesList if it exists
            if (labeledNodesList[selectedNode.id]) {
                // Add the previous label back to availableLabels
                const previousLabelText = labeledNodesList[selectedNode.id];
                usedLabels.delete(previousLabelText);  // Remove from used labels
                availableLabels.push(previousLabelText); // Add back to available labels

                delete labeledNodesList[selectedNode.id]; // Remove from labeled nodes list
                removeLabelFromUI(selectedNode.id); // Remove from UI list
            }
        } else {
            // Check if the node already had a label
            if (labeledNodesList[selectedNode.id]) {
                const previousLabelText = labeledNodesList[selectedNode.id];
                // Remove the previous label before setting the new one
                labels[selectedNode.id].labelPlane.dispose();
                labels[selectedNode.id].labelContainer.dispose();
                usedLabels.delete(previousLabelText); // Remove from used labels
                availableLabels.push(previousLabelText); // Add back the previous label
            }

            // Create and store the new label
            let label = createLabel(selectedNode, labelText);
            labels[selectedNode.id] = label;
            labeledNodesList[selectedNode.id] = labelText;

            // Mark the new label as used
            usedLabels.add(labelText);

            // Remove the new label from availableLabels
            const labelIndex = availableLabels.indexOf(labelText);
            if (labelIndex !== -1) {
                availableLabels.splice(labelIndex, 1); // Remove the label from availableLabels
            }

            // Update the label list in the UI
            updateLabelList(selectedNode.id, labelText);
        }

        selectedNode = null;  // Reset selected node after labeling
        hideCustomModal();  // Hide the custom modal after setting the label
    } else {
        alert("Please select a node first.");
    }
});




// test start chatgpt function to suggest next labelling
// List of all available labels
const availableLabels = [
    "ICA_Root_L", "ICA_Root_R", "ICA-MCA-ACA_L", "ICA-MCA-ACA_R", 
    "A1-A2_L", "A1-A2_R", "M1-M2_L", "M1-M2_R", 
    "OA-ICA_L", "OA-ICA_R", "OA_L", "OA_R", 
    "M2-M3_L", "M2-M3_R", "VA_Root_L", "VA_Root_R", 
    "BA-VA", "PCA-BA", "P1-P2-Pcomm_L", "P1-P2-Pcomm_R", 
    "Pcomm-ICA_L", "Pcomm-ICA_R"
];

// Track used labels
let usedLabels = new Set();  // Use a set to store labels that are already applied

function setLabelForNode(node, labelText) {
    // Add the label to the used labels set
    usedLabels.add(labelText);

    // Create the label for the node
    let label = createLabel(node, labelText);
    labels[node.id] = label;
    labeledNodesList[node.id] = labelText;

    // Update the label list in the UI
    updateLabelList(node.id, labelText);
}

// Example use in setLabelButton event listener
// document.getElementById('setLabelButton').addEventListener('click', () => {
//     if (selectedNode) {
//         let labelText = document.getElementById('nodeLabel').options[document.getElementById('nodeLabel').selectedIndex].text;
//         setLabelForNode(selectedNode, labelText);

//         selectedNode = null;
//         hideCustomModal();
//     } else {
//         alert("Please select a node first.");
//     }
// });


// Function to suggest unused labels
function suggestUnusedLabel() {
    // Find the first label from availableLabels that is not in usedLabels
    let suggestedLabel = availableLabels.find(label => !usedLabels.has(label));

    if (suggestedLabel) {
        alert(`Suggested Label: ${suggestedLabel}`);
    } else {
        alert("All labels have been used.");
    }
}

// Add event listener for the "L" or "l" shortcut key
window.addEventListener('keydown', (event) => {
    if (event.key === 'L' || event.key === 'l') {
        suggestUnusedLabel();  // Call suggestion function
    }
});
// test end chatgpt

let labelsVisible = true;  // Track the visibility of the labels (default is visible)
function toggleLabelVisibility() {
    labelsVisible = !labelsVisible;  // Toggle the visibility flag

    // Loop through all labels and toggle their visibility
    for (let id in labels) {
        if (labelsVisible) {
            labels[id].labelContainer.isVisible = true;  // Show label
        } else {
            labels[id].labelContainer.isVisible = false;  // Hide label
        }
    }
}
// Add event listener for "H" or "h" key to toggle label visibility
window.addEventListener('keydown', (event) => {
    if (event.key === 'H' || event.key === 'h') {
        toggleLabelVisibility();  // Call the toggle function when "H" is pressed
    }
});

let selectedEdge = null;  // Variable to store the selected edge
let savedEdges = [];  // Array to store the node pairs of confirmed edges

function onSelectEdge() {
    let pickResult = scene.pick(scene.pointerX, scene.pointerY);
    if (pickResult.hit && pickResult.pickedMesh && pickResult.pickedMesh.name.startsWith("line")) {
        selectedEdge = pickResult.pickedMesh;

        // Save the original color of the edge (assuming green)
        let originalColor = selectedEdge.color.clone();

        // Change the edge color to red to indicate selection
        selectedEdge.color = new BABYLON.Color3(1, 0, 0);  // Red color

        // Confirm deletion dialog
        let confirmDelete = confirm("Are you sure to delete this edge? Press T to view guide before deleting.");
        if (confirmDelete) {
            // Change the edge color to black if confirmed
            selectedEdge.color = new BABYLON.Color3(0, 0, 0);  // Black color

            // Assuming edge name is formatted as 'line{from}-{to}', extract node pairs
            let edgeName = selectedEdge.name;
            let nodePair = edgeName.replace("line", "").split("-").map(Number);

            // Save the node pairs
            savedEdges.push(nodePair);  // Store the node pair [fromNode, toNode]
            console.log("Saved edge between nodes:", nodePair);
        } else {
            // Restore the original color (green) if not confirmed
            selectedEdge.color = originalColor;
        }
    }
}



function updateActiveButton(buttonId) {
    document.querySelectorAll('.mode-button').forEach(button => {
        button.classList.remove('active');  // Remove active class from all buttons
    });
    document.getElementById(buttonId).classList.add('active');  // Add active class to the current button
}

document.getElementById('transformModeButton').addEventListener('click', () => {
    mode = 'transform';
    scene.onPointerDown = null;
    updateActiveButton('transformModeButton');  // Update button styles
});

document.getElementById('nodeModeButton').addEventListener('click', () => {
    mode = 'select';
    scene.onPointerDown = onSelectNode;
    updateActiveButton('nodeModeButton');  // Update button styles
});

document.getElementById('edgeModeButton').addEventListener('click', () => {
    mode = 'edge';
    scene.onPointerDown = onSelectEdge;
    updateActiveButton('edgeModeButton');  // Update button styles
});



// Keyboard Shortcuts for D (toggle mode), R (reset), Ctrl+S (save), = (increase node size), and - (decrease node size)
window.addEventListener('keydown', (event) => {
    if (event.key === 'D' || event.key === 'd') {
        // Toggle the mode
        document.getElementById('modeButton').click();
    } else if (event.key === 'R' || event.key === 'r') {
        // Reset labels
        document.getElementById('resetButton').click();
    } else if (event.key === 's' && event.ctrlKey) {
        // Save labels with Ctrl+S
        event.preventDefault();  // Prevent browser's default save action
        document.getElementById('saveButton').click();
    } else if (event.key === '=') {
        // Increase node size via slider
        nodeSizeSlider.value = Math.min(parseInt(nodeSizeSlider.value) + 1, 6);  // Increment and cap at 6
        nodeSizeSlider.dispatchEvent(new Event('input'));  // Trigger the input event
    } else if (event.key === '-') {
        // Decrease node size via slider
        nodeSizeSlider.value = Math.max(parseInt(nodeSizeSlider.value) - 1, 1);  // Decrement and cap at 1
        nodeSizeSlider.dispatchEvent(new Event('input'));  // Trigger the input event
    }
});


// Adding this for the sake of tracking subject names
// let subjectName = "";  // Variable to store the subject name

let subjectName = "";  // Variable to store the subject name

function handleFileUpload(file) {
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);

            // Extract the first six characters of the filename as the subject name
            subjectName = file.name.substring(0, 7);  // Get first 7 characters of the filename

            // Update the <h3> tag inside #labelListContainer with the subject name
            document.getElementById('subjectNameHeader').innerText = `${subjectName} Nodes`;

            // Proceed with creating the graph
            createGraph(data);

            // Proceed with creating the guide
            createGuide(data);

        } catch (error) {
            console.error("Invalid JSON format:", error);
            alert("The uploaded file is not a valid JSON file. Please try again.");
        }
    };
    reader.readAsText(file);
}

//save nodes and deleted edges both.
function saveLabelsAsJSON() {
    const labeledNodes = [];

    // Collect labeled nodes and their labels
    for (let id in labeledNodesList) {
        labeledNodes.push({
            id: id,
            labelText: labeledNodesList[id],  // Save both id and labelText
        });
    }

    // Prepare data to save, including both labeled nodes and saved edges
    const dataToSave = {
        labeledNodes: labeledNodes,
        savedEdges: savedEdges  // Include the saved edges (node pairs)
    };

    // Convert to JSON string
    const jsonString = JSON.stringify(dataToSave, null, 2);

    // Create a Blob from the JSON string
    const blob = new Blob([jsonString], { type: "application/json" });

    // Use subjectName for the filename
    const fileName = subjectName ? `${subjectName}_labeled_nodes_and_edges.json` : "labeled_nodes_and_edges.json";

    // Create a link element to download the file
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);  // Clean up after download
}

// upload guide mesh
// function handleFileUpload(event) {
//     const file = event.target.files[0];
//     if (!file) return;

//     const reader = new FileReader();
//     reader.onload = function (e) {
//         const contents = e.target.result;
//         const meshData = JSON.parse(contents);
function createGuide(meshData) {
        // Extract vertices and faces from the JSON file
        const vertices = meshData.vertices.flat(); // Flatten the vertices array
        const faces = meshData.faces.flat();       // Flatten the faces array

        // Create a new mesh in Babylon.js
        const customMesh = new BABYLON.Mesh("custom", scene);
        const vertexData = new BABYLON.VertexData();

        vertexData.positions = vertices;
        vertexData.indices = faces;

        // Apply vertex data to the mesh
        vertexData.applyToMesh(customMesh);

        // Set material with transparency
        const material = new BABYLON.StandardMaterial("material", scene);
        material.alpha = 0.2; // Set transparency
        material.diffuseColor = new BABYLON.Color3(0.8, 0.8, 0.8); // Green color for visibility
        customMesh.material = material;

        // Optionally scale and position the mesh
        // customMesh.scaling = new BABYLON.Vector3(0.1, 0.1, 0.1);
        customMesh.position = new BABYLON.Vector3(0, 0, 0);

        // Render loop
        // engine.runRenderLoop(function () {
        //     scene.render();
        // });
    }

//     reader.readAsText(file); // Read the JSON file as text
// }

// // Trigger the file input when the button is clicked
// document.getElementById("uploadButton").addEventListener("click", function() {
//     document.getElementById("fileInput").click();
// });

// // Handle file input change event (file selection)
// document.getElementById("fileInput").addEventListener("change", handleFileUpload);



// // Add WebXR experience for VR exploration on Quest 2
// async function enableVR() {
//     const xr = await scene.createDefaultXRExperienceAsync({
//         uiOptions: {
//             sessionMode: "immersive-vr", // VR mode
//             referenceSpaceType: "local-floor"
//         },
//         optionalFeatures: true // Enable optional WebXR features
//     });

//     // Optional: Add teleportation and movement
//     xr.teleportation.addFloorMesh(scene); // Enable teleportation
// }

// // Enable VR when the page loads
// enableVR();

// Resize event handler to keep canvas responsive
window.addEventListener('resize', () => {
    engine.resize();
});

// Initialize the scene and show the upload modal
initializeScene();
engine.runRenderLoop(() => {
    scene.render();
});







