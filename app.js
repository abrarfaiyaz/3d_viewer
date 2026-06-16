

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
camera.wheelPrecision = 35;
camera.panningSensibility = 70;

let activeHomeView = 'z';
let displayedAnatomyHomeView = null;
let homeCameraViews = {
    z: {
        alpha: Math.PI / 2,
        beta: Math.PI / 3,
        radius: 260,
        target: new BABYLON.Vector3(0, 0, 0)
    },
    x: {
        alpha: 0,
        beta: Math.PI / 3,
        radius: 260,
        target: new BABYLON.Vector3(0, 0, 0)
    }
};

function getHomeCameraView(viewKey = activeHomeView) {
    return homeCameraViews[viewKey] || homeCameraViews.z;
}

function applyHomeCameraView(viewKey = activeHomeView, useAnimation = true) {
    activeHomeView = viewKey;
    const homeCameraView = getHomeCameraView(viewKey);
    if (useAnimation) {
        BABYLON.Animation.CreateAndStartAnimation("cameraHomeAlpha", camera, "alpha", 60, 20, camera.alpha, homeCameraView.alpha, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
        BABYLON.Animation.CreateAndStartAnimation("cameraHomeBeta", camera, "beta", 60, 20, camera.beta, homeCameraView.beta, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
        BABYLON.Animation.CreateAndStartAnimation("cameraHomeRadius", camera, "radius", 60, 20, camera.radius, homeCameraView.radius, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
        BABYLON.Animation.CreateAndStartAnimation("cameraHomeTarget", camera, "target", 60, 20, camera.target.clone(), homeCameraView.target.clone(), BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
    } else {
        camera.alpha = homeCameraView.alpha;
        camera.beta = homeCameraView.beta;
        camera.radius = homeCameraView.radius;
        camera.target = homeCameraView.target.clone();
    }
}

function updateHomeCameraFromNodes() {
    if (!nodeMeshes.length) {
        return;
    }

    let min = nodeMeshes[0].position.clone();
    let max = nodeMeshes[0].position.clone();

    nodeMeshes.forEach(node => {
        min = BABYLON.Vector3.Minimize(min, node.position);
        max = BABYLON.Vector3.Maximize(max, node.position);
    });

    const center = min.add(max).scale(0.5);
    const bounds = max.subtract(min);
    const largestDimension = Math.max(bounds.x, bounds.y, bounds.z);

    const homeRadius = Math.max(largestDimension * 1.6, 80);
    homeCameraViews = {
        z: {
            alpha: Math.PI / 2,
            beta: Math.PI / 3,
            radius: homeRadius,
            target: center
        },
        x: {
            alpha: 0,
            beta: Math.PI / 3,
            radius: homeRadius,
            target: center
        }
    };

    camera.lowerRadiusLimit = Math.max(largestDimension * 0.08, 8);
    camera.upperRadiusLimit = Math.max(largestDimension * 5, homeRadius * 2);
    camera.minZ = 0.1;
    camera.maxZ = Math.max(largestDimension * 10, 1000);
    applyHomeCameraView('z', false);
}

// Screen-relative lighting keeps nodes readable while the user rotates the scene.
let light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
light.intensity = 0.78;
light.groundColor = new BABYLON.Color3(0.22, 0.24, 0.28);
light.specular = new BABYLON.Color3(0.08, 0.08, 0.08);

let screenTopLight = new BABYLON.DirectionalLight("screenTopLight", new BABYLON.Vector3(0, -1, 1), scene);
screenTopLight.intensity = 0.62;
screenTopLight.diffuse = new BABYLON.Color3(1, 0.98, 0.92);
screenTopLight.specular = new BABYLON.Color3(0.22, 0.22, 0.22);

function updateScreenFixedLighting() {
    light.direction = camera.getDirection(BABYLON.Axis.Y).normalize();
    screenTopLight.direction = camera.getDirection(new BABYLON.Vector3(0, -0.65, 1)).normalize();
}

function getAngleDifference(firstAngle, secondAngle) {
    return Math.atan2(Math.sin(firstAngle - secondAngle), Math.cos(firstAngle - secondAngle));
}

function getMatchingHomeViewKey() {
    const matchingHomeKey = Object.keys(homeCameraViews).find(viewKey => {
        const homeCameraView = homeCameraViews[viewKey];
        const radiusTolerance = Math.max(homeCameraView.radius * 0.015, 1);
        return Math.abs(getAngleDifference(camera.alpha, homeCameraView.alpha)) < 0.025 &&
            Math.abs(camera.beta - homeCameraView.beta) < 0.025 &&
            Math.abs(camera.radius - homeCameraView.radius) < radiusTolerance &&
            BABYLON.Vector3.Distance(camera.target, homeCameraView.target) < 1;
    });

    return matchingHomeKey || null;
}

function isCameraAtHomeView() {
    return getMatchingHomeViewKey() !== null;
}

function updateAnatomyDirectionVisibility() {
    const matchingHomeKey = getMatchingHomeViewKey();
    if (matchingHomeKey && matchingHomeKey !== displayedAnatomyHomeView) {
        activeHomeView = matchingHomeKey;
        updateAllAnatomyDirectionButtons();
        displayedAnatomyHomeView = matchingHomeKey;
    } else if (!matchingHomeKey) {
        displayedAnatomyHomeView = null;
    }
    anatomyDirectionOverlay.classList.toggle('visible', matchingHomeKey !== null);
}

function updateAnatomyDirectionButton(screenSide) {
    const button = document.querySelector(`.anatomy-direction-button[data-screen-side="${screenSide}"]`);
    if (!button) {
        return;
    }

    const assignedDirection = anatomyDirectionAssignments[activeHomeView][screenSide];
    const directionConfig = anatomyDirectionOptions[assignedDirection];
    button.textContent = directionConfig ? directionConfig.marker : "?";
    button.classList.toggle('unset', !directionConfig);
    button.title = directionConfig ? directionConfig.description : `Set ${screenSide} screen anatomical direction`;
    button.setAttribute('aria-label', button.title);
}

function updateAllAnatomyDirectionButtons() {
    Object.keys(anatomyDirectionAssignments[activeHomeView]).forEach(updateAnatomyDirectionButton);
}

function resetAnatomyDirectionAssignments() {
    anatomyDirectionAssignments = {
        z: createEmptyAnatomyDirectionSides(),
        x: createEmptyAnatomyDirectionSides()
    };
    displayedAnatomyHomeView = null;
    updateAllAnatomyDirectionButtons();
}

function openAnatomyDirectionModal(screenSide) {
    selectedAnatomyScreenSide = screenSide;
    anatomyDirectionSelect.value = anatomyDirectionAssignments[activeHomeView][screenSide] || "";
    anatomyDirectionViewLabel.innerText = activeHomeView === 'x' ? "(X Home)" : "(Z Home)";
    anatomyDirectionModal.style.display = 'flex';
}

const orientationCanvas = document.getElementById('orientationCanvas');
const movementReference = document.getElementById('movementReference');
const referenceToggleButton = document.getElementById('referenceToggleButton');
let orientationEngine = null;
let orientationScene = null;
let orientationCamera = null;
let orientationSphere = null;

function createAxisLine(axisName, endPoint, color) {
    const line = BABYLON.MeshBuilder.CreateLines(axisName, {
        points: [BABYLON.Vector3.Zero(), endPoint]
    }, orientationScene);
    line.color = color;
    return line;
}

function createAxisLabel(text, position, color) {
    const plane = BABYLON.MeshBuilder.CreatePlane(`${text}Label`, { size: 0.85 }, orientationScene);
    plane.position = position;
    plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

    const texture = new BABYLON.DynamicTexture(`${text}Texture`, { width: 96, height: 96 }, orientationScene, true);
    texture.hasAlpha = true;
    texture.drawText(text, 34, 60, "bold 44px Arial", color, "transparent", true);

    const material = new BABYLON.StandardMaterial(`${text}LabelMaterial`, orientationScene);
    material.diffuseTexture = texture;
    material.diffuseTexture.hasAlpha = true;
    material.useAlphaFromDiffuseTexture = true;
    material.emissiveColor = BABYLON.Color3.White();
    material.disableLighting = true;
    material.backFaceCulling = false;
    plane.material = material;
}

function initializeOrientationWidget() {
    if (!orientationCanvas) {
        return;
    }

    orientationEngine = new BABYLON.Engine(orientationCanvas, true, { preserveDrawingBuffer: true, stencil: true }, true);
    orientationScene = new BABYLON.Scene(orientationEngine);
    orientationScene.clearColor = new BABYLON.Color4(0, 0, 0, 0);
    orientationEngine.resize();

    orientationCamera = new BABYLON.ArcRotateCamera("orientationCamera", camera.alpha, camera.beta, 6, BABYLON.Vector3.Zero(), orientationScene);
    orientationCamera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
    orientationCamera.orthoLeft = -3.4;
    orientationCamera.orthoRight = 3.4;
    orientationCamera.orthoTop = 3.4;
    orientationCamera.orthoBottom = -3.4;
    orientationCamera.inputs.clear();

    const widgetLight = new BABYLON.HemisphericLight("orientationLight", new BABYLON.Vector3(0.2, 1, -0.4), orientationScene);
    widgetLight.intensity = 1.1;

    const sphereMaterial = new BABYLON.StandardMaterial("orientationSphereMaterial", orientationScene);
    sphereMaterial.diffuseColor = new BABYLON.Color3(0.82, 0.9, 1);
    sphereMaterial.emissiveColor = new BABYLON.Color3(0.08, 0.12, 0.18);
    sphereMaterial.specularColor = new BABYLON.Color3(0.55, 0.65, 0.75);

    orientationSphere = BABYLON.MeshBuilder.CreateSphere("orientationSphere", { diameter: 1.18, segments: 24 }, orientationScene);
    orientationSphere.material = sphereMaterial;

    createAxisLine("orientationAxisX", new BABYLON.Vector3(2.55, 0, 0), new BABYLON.Color3(1, 0.18, 0.16));
    createAxisLine("orientationAxisY", new BABYLON.Vector3(0, 2.55, 0), new BABYLON.Color3(0.18, 1, 0.38));
    createAxisLine("orientationAxisZ", new BABYLON.Vector3(0, 0, 2.55), new BABYLON.Color3(0.22, 0.55, 1));

    createAxisLabel("X", new BABYLON.Vector3(3, 0, 0), "#ff4d4d");
    createAxisLabel("Y", new BABYLON.Vector3(0, 3, 0), "#4dff88");
    createAxisLabel("Z", new BABYLON.Vector3(0, 0, 3), "#4da3ff");
}

function renderOrientationWidget() {
    if (!orientationScene || !orientationCamera) {
        return;
    }

    orientationCamera.alpha = camera.alpha;
    orientationCamera.beta = camera.beta;
    if (orientationSphere) {
        orientationSphere.rotation.y += 0.012;
    }
    orientationScene.render();
}

// Variables for labeling
let mode = 'transform';
let labeledNodesList = {}; // Object to store labeled nodes
let labels = {};
let nodeMeshes = [];
let edgeMeshes = [];
let edgeDefinitions = [];
let edgeRadius = 0.8;
let selectedNode = null; // Variable to store the currently selected node

// Custom modal elements
const customModal = document.getElementById('customModal');
const dropdownMenu = document.getElementById('nodeLabel');
const labelListContainer = document.getElementById('labelListContainer');
const labelPanelToggle = document.getElementById('labelPanelToggle');
const brandLogoButton = document.getElementById('brandLogoButton');
const anatomyDirectionOverlay = document.getElementById('anatomyDirectionOverlay');
const anatomyDirectionModal = document.getElementById('anatomyDirectionModal');
const anatomyDirectionViewLabel = document.getElementById('anatomyDirectionViewLabel');
const anatomyDirectionSelect = document.getElementById('anatomyDirectionSelect');
const setAnatomyDirectionButton = document.getElementById('setAnatomyDirectionButton');
const cancelAnatomyDirectionButton = document.getElementById('cancelAnatomyDirectionButton');
const anatomyDirectionButtons = document.querySelectorAll('.anatomy-direction-button');
customModal.style.display = 'none'; // Initially hidden
anatomyDirectionModal.style.display = 'none';

brandLogoButton.addEventListener('click', () => {
    window.location.reload();
});

const anatomyDirectionOptions = {
    anatomical_left: {
        marker: "Left",
        description: "Anatomical Left - patient's left side"
    },
    anatomical_right: {
        marker: "Right",
        description: "Anatomical Right - patient's right side"
    },
    nose_anterior: {
        marker: "Nose",
        description: "Anterior / Nose - toward the face or nose"
    },
    back_posterior: {
        marker: "Back",
        description: "Posterior / Back of Head - toward the back of the head"
    },
    top_superior: {
        marker: "Top",
        description: "Superior / Top of Brain - toward the crown/top surface"
    },
    neck_inferior: {
        marker: "Neck",
        description: "Inferior / Neck Surface - toward the neck/base of brain"
    }
};

const anatomyHomeViewSideAxes = {
    z: {
        top: "y+",
        right: "x+",
        bottom: "y-",
        left: "x-"
    },
    x: {
        top: "y+",
        right: "z+",
        bottom: "y-",
        left: "z-"
    }
};

function createEmptyAnatomyDirectionSides() {
    return {
        top: "",
        right: "",
        bottom: "",
        left: ""
    };
}

let anatomyDirectionAssignments = {
    z: createEmptyAnatomyDirectionSides(),
    x: createEmptyAnatomyDirectionSides()
};
let selectedAnatomyScreenSide = null;

function syncAnatomyDirectionAcrossHomeViews(sourceViewKey, sourceScreenSide, directionValue) {
    const sourceAxis = anatomyHomeViewSideAxes[sourceViewKey]?.[sourceScreenSide];
    if (!sourceAxis) {
        return;
    }

    Object.keys(anatomyHomeViewSideAxes).forEach(viewKey => {
        if (viewKey === sourceViewKey) {
            return;
        }

        const matchingScreenSide = Object.keys(anatomyHomeViewSideAxes[viewKey]).find(screenSide => {
            return anatomyHomeViewSideAxes[viewKey][screenSide] === sourceAxis;
        });

        if (matchingScreenSide) {
            anatomyDirectionAssignments[viewKey][matchingScreenSide] = directionValue;
        }
    });
}

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

function createEdgeMaterial(name, color) {
    const material = new BABYLON.StandardMaterial(name, scene);
    material.diffuseColor = color;
    material.emissiveColor = color.scale(0.35);
    material.specularColor = new BABYLON.Color3(0.08, 0.08, 0.08);
    return material;
}

function getEdgeColor(edgeMesh) {
    if (edgeMesh.material && edgeMesh.material.diffuseColor) {
        return edgeMesh.material.diffuseColor.clone();
    }
    return edgeMesh.color ? edgeMesh.color.clone() : new BABYLON.Color3(0, 1, 0);
}

function setEdgeColor(edgeMesh, color) {
    if (!edgeMesh.material) {
        edgeMesh.material = createEdgeMaterial(`edgeMaterial-${edgeMesh.name}`, color);
    }
    if (edgeMesh.material.diffuseColor) {
        edgeMesh.material.diffuseColor = color;
        edgeMesh.material.emissiveColor = color.scale(0.35);
    }
    if (edgeMesh.color) {
        edgeMesh.color = color;
    }
}

function createEdgeMesh(edgeData, color = new BABYLON.Color3(0, 1, 0)) {
    let fromNode = nodeMeshes[edgeData.from];
    let toNode = nodeMeshes[edgeData.to];
    if (!fromNode || !toNode) {
        return null;
    }

    let edge = BABYLON.MeshBuilder.CreateTube(`line${edgeData.from}-${edgeData.to}`, {
        path: [fromNode.position, toNode.position],
        radius: edgeRadius,
        tessellation: 8,
        cap: BABYLON.Mesh.CAP_ALL,
        updatable: false
    }, scene);

    edge.material = createEdgeMaterial(`edgeMaterial-${edgeData.from}-${edgeData.to}`, color);
    return edge;
}

function updateEdgeSizes(newRadius) {
    edgeRadius = newRadius;
    const edgeColors = {};
    edgeMeshes.forEach(edge => {
        edgeColors[edge.name] = getEdgeColor(edge);
        edge.dispose();
    });
    edgeMeshes = [];
    edgeDefinitions.forEach(edgeData => {
        const edgeName = `line${edgeData.from}-${edgeData.to}`;
        const edge = createEdgeMesh(edgeData, edgeColors[edgeName] || new BABYLON.Color3(0, 1, 0));
        if (edge) {
            edgeMeshes.push(edge);
        }
    });
}

function updateNodeSizes(newDiameter) {
    nodeMeshes.forEach(node => {
        node.scaling = new BABYLON.Vector3(newDiameter / 6, newDiameter / 6, newDiameter / 6);
    });
}

function updateLabelList(nodeId, labelText) {
    let listItem = document.createElement('li');
    listItem.innerText = `Node ${nodeId}: ${labelText}`;
    document.getElementById('labelList').appendChild(listItem);
}

function clearGraphScene() {
    resetLabels();
    nodeMeshes.forEach(node => node.dispose());
    edgeMeshes.forEach(edge => edge.dispose());
    nodeMeshes = [];
    edgeMeshes = [];
    edgeDefinitions = [];
    savedEdges = [];
    selectedNode = null;
    selectedEdge = null;
    previouslySelectedNode = null;
    resetAnatomyDirectionAssignments();

    if (guideMesh) {
        guideMesh.dispose();
        guideMesh = null;
    }
}

// Function to create the graph
function createGraph(data) {
    clearGraphScene();
    nodeMeshes = [];
    edgeMeshes = [];
    edgeDefinitions = data.edges.slice();
    
    // Create Nodes
    data.nodes.forEach(nodeData => {
        let node = BABYLON.MeshBuilder.CreateSphere(`${nodeData.id}`, { diameter: 6 }, scene);
        node.position = new BABYLON.Vector3(nodeData.x, nodeData.y, nodeData.z);
        nodeMeshes.push(node);
    });
    updateNodeSizes(parseFloat(document.getElementById('nodeSizeSlider').value));


    // Create Edges
    edgeDefinitions.forEach(edgeData => {
    let edge = createEdgeMesh(edgeData);
    if (edge) {
        edgeMeshes.push(edge);
    }
});

    updateHomeCameraFromNodes();
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


// redo 
function loadLabelsFromJSON(data) {
    console.log("Loading labels and edges from JSON:", data);

    // Load labeled nodes
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

    // Load saved edges and change their color to black
    if (data.savedEdges && Array.isArray(data.savedEdges)) {
        data.savedEdges.forEach(edge => {
            if (edge.length === 2) {
                if (findSavedEdgeIndex(edge) === -1) {
                    savedEdges.push(edge);
                }
                console.log(`Saved edge between nodes: ${edge}`);

                // Construct the edge name (assuming the format 'line{from}-{to}')
                let edgeName = `line${edge[0]}-${edge[1]}`;

                // Find the edge mesh by name
                let edgeMesh = scene.getMeshByName(edgeName);

                if (edgeMesh) {
                    // Change the color of the edge to black
                    setEdgeColor(edgeMesh, new BABYLON.Color3(0, 0, 0)); // Black color
                    console.log(`Edge ${edgeName} color changed to black.`);
                } else {
                    console.error(`Edge ${edgeName} not found in scene.`);
                }
            }
        });
    } else {
        console.log("No saved edges found in JSON.");
    }

    if (data.anatomicalDirections && typeof data.anatomicalDirections === "object") {
        const hasHomeViewAssignments = data.anatomicalDirections.z || data.anatomicalDirections.x;
        if (hasHomeViewAssignments) {
            ['z', 'x'].forEach(viewKey => {
                const savedViewAssignments = data.anatomicalDirections[viewKey] || {};
                Object.keys(anatomyDirectionAssignments[viewKey]).forEach(screenSide => {
                    const directionValue = savedViewAssignments[screenSide];
                    anatomyDirectionAssignments[viewKey][screenSide] = anatomyDirectionOptions[directionValue] ? directionValue : "";
                });
            });
        } else {
            Object.keys(anatomyDirectionAssignments.z).forEach(screenSide => {
                const directionValue = data.anatomicalDirections[screenSide];
                const safeDirectionValue = anatomyDirectionOptions[directionValue] ? directionValue : "";
                anatomyDirectionAssignments.z[screenSide] = safeDirectionValue;
                anatomyDirectionAssignments.x[screenSide] = safeDirectionValue;
            });
        }
        updateAllAnatomyDirectionButtons();
    }
}

//test chatgpt function for updating the available list of variables when loading some predone labels
// function loadLabelsFromJSON(data) {
//     console.log("Loading labels from JSON:", data);

//     data.labeledNodes.forEach(labeledNode => {
//         const nodeId = labeledNode.id;
//         const labelText = labeledNode.labelText;

//         // Find the node by id in the existing nodeMeshes array
//         const node = nodeMeshes.find(n => n.id === String(nodeId));
//         if (node) {
//             console.log(`Found node ${nodeId}, applying label: ${labelText}`);

//             // Create the label for the node
//             let label = createLabel(node, labelText);
//             labels[nodeId] = label;
//             labeledNodesList[nodeId] = labelText;

//             // Update the usedLabels set and remove from availableLabels
//             usedLabels.add(labelText);

//             // Remove the label from availableLabels if it's used
//             const labelIndex = availableLabels.indexOf(labelText);
//             if (labelIndex !== -1) {
//                 availableLabels.splice(labelIndex, 1); // Remove the label from availableLabels
//             }

//             // Update the label list in the UI
//             updateLabelList(nodeId, labelText);
//         } else {
//             console.error(`Node ${nodeId} not found!`);
//         }
//     });
// }


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

document.getElementById('homeZButton').addEventListener('click', () => {
    applyHomeCameraView('z');
});

document.getElementById('homeXButton').addEventListener('click', () => {
    applyHomeCameraView('x');
});

referenceToggleButton.addEventListener('click', () => {
    const isCollapsed = movementReference.classList.toggle('collapsed');
    referenceToggleButton.title = isCollapsed ? "Show 3D reference" : "Hide 3D reference";
    referenceToggleButton.setAttribute('aria-label', referenceToggleButton.title);
    referenceToggleButton.setAttribute('aria-expanded', String(!isCollapsed));
});

labelPanelToggle.addEventListener('click', () => {
    const isCollapsed = labelListContainer.classList.toggle('collapsed');
    labelPanelToggle.title = isCollapsed ? "Show node labels" : "Hide node labels";
    labelPanelToggle.setAttribute('aria-label', labelPanelToggle.title);
    labelPanelToggle.setAttribute('aria-expanded', String(!isCollapsed));
});

anatomyDirectionButtons.forEach(button => {
    button.addEventListener('click', () => {
        openAnatomyDirectionModal(button.dataset.screenSide);
    });
});

setAnatomyDirectionButton.addEventListener('click', () => {
    if (selectedAnatomyScreenSide) {
        const selectedDirection = anatomyDirectionSelect.value;
        anatomyDirectionAssignments[activeHomeView][selectedAnatomyScreenSide] = selectedDirection;
        syncAnatomyDirectionAcrossHomeViews(activeHomeView, selectedAnatomyScreenSide, selectedDirection);
        updateAllAnatomyDirectionButtons();
    }
    anatomyDirectionModal.style.display = 'none';
    selectedAnatomyScreenSide = null;
});

cancelAnatomyDirectionButton.addEventListener('click', () => {
    anatomyDirectionModal.style.display = 'none';
    selectedAnatomyScreenSide = null;
});

// Add an event listener to adjust node sizes via the slider
const nodeSizeSlider = document.getElementById('nodeSizeSlider');
nodeSizeSlider.addEventListener('input', (event) => {
    updateNodeSizes(parseFloat(event.target.value));
});

const edgeSizeSlider = document.getElementById('edgeSizeSlider');
edgeSizeSlider.addEventListener('input', (event) => {
    updateEdgeSizes(parseFloat(event.target.value));
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
const restartButton = document.getElementById('restartButton');
let uploadModalMode = 'initial';

// Event listener for file input
fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        handleFileUpload(file);
        uploadModal.style.display = 'none';  // Hide the modal after upload
        uploadModalMode = 'loaded';
        fileInput.value = '';
    }
});

// Cancel button event listener: load default graph if the user cancels the upload
cancelButton.addEventListener('click', () => {
    uploadModal.style.display = 'none';  // Hide the modal
    if (uploadModalMode === 'initial') {
        loadDefaultGraph();  // Load the default graph from the JSON file
        uploadModalMode = 'loaded';
    }
});

restartButton.addEventListener('click', () => {
    uploadModalMode = 'restart';
    fileInput.value = '';
    uploadModal.style.display = 'flex';
});

// Function to initialize the scene
function initializeScene() {
    // Show the upload modal when the website loads
    uploadModalMode = 'initial';
    uploadModal.style.display = 'flex';
}

// Function to display the custom modal with the dropdown
function showCustomModal(currentLabelText = "Undefined") {
    const matchingOption = Array.from(dropdownMenu.options).find(option => option.text === currentLabelText);
    dropdownMenu.value = matchingOption ? matchingOption.value : "0";
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
    let pickResult = scene.pick(scene.pointerX, scene.pointerY, mesh => nodeMeshes.includes(mesh));
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
                showCustomModal(labeledNodesList[selectedNode.id]);  // Show custom modal to relabel
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

function removeNodeLabel(nodeId, restoreAvailability = true) {
    if (labels[nodeId]) {
        labels[nodeId].labelPlane.dispose();
        labels[nodeId].labelContainer.dispose();
        delete labels[nodeId];
    }

    if (labeledNodesList[nodeId]) {
        const previousLabelText = labeledNodesList[nodeId];
        if (restoreAvailability && !availableLabels.includes(previousLabelText)) {
            availableLabels.push(previousLabelText);
        }
        usedLabels.delete(previousLabelText);
        delete labeledNodesList[nodeId];
    }

    removeLabelFromUI(nodeId);
}


document.getElementById('setLabelButton').addEventListener('click', () => {
    if (selectedNode) {
        let labelText = document.getElementById('nodeLabel').options[document.getElementById('nodeLabel').selectedIndex].text;

        // If the label is "Undefined"
        if (labelText === "Undefined") {
            removeNodeLabel(selectedNode.id);
        } else {
            // Check if the node already had a label
            if (labeledNodesList[selectedNode.id]) {
                removeNodeLabel(selectedNode.id);
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


let selectedEdge = null;  // Variable to store the selected edge
let savedEdges = [];  // Array to store the node pairs of confirmed edges

function getNodePairFromEdge(edgeMesh) {
    return edgeMesh.name.replace("line", "").split("-").map(Number);
}

function edgePairsMatch(firstPair, secondPair) {
    return firstPair.length === 2 &&
        secondPair.length === 2 &&
        firstPair[0] === secondPair[0] &&
        firstPair[1] === secondPair[1];
}

function findSavedEdgeIndex(nodePair) {
    return savedEdges.findIndex(savedEdge => edgePairsMatch(savedEdge, nodePair));
}

function isDeletedEdgeColor(edgeMesh) {
    const edgeColor = getEdgeColor(edgeMesh);
    return edgeColor.r < 0.08 && edgeColor.g < 0.08 && edgeColor.b < 0.08;
}

function onSelectEdge() {
    let pickResult = scene.pick(scene.pointerX, scene.pointerY, mesh => mesh.name.startsWith("line"));
    if (pickResult.hit && pickResult.pickedMesh && pickResult.pickedMesh.name.startsWith("line")) {
        selectedEdge = pickResult.pickedMesh;
        let nodePair = getNodePairFromEdge(selectedEdge);
        let savedEdgeIndex = findSavedEdgeIndex(nodePair);

        if (savedEdgeIndex !== -1 || isDeletedEdgeColor(selectedEdge)) {
            let confirmUndelete = confirm("This edge is marked as deleted. Do you want to undelete it?");
            if (confirmUndelete) {
                if (savedEdgeIndex !== -1) {
                    savedEdges.splice(savedEdgeIndex, 1);
                }
                setEdgeColor(selectedEdge, new BABYLON.Color3(0, 1, 0));  // Green color
                console.log("Undeleted edge between nodes:", nodePair);
            }
            return;
        }

        // Save the original color of the edge (assuming green)
        let originalColor = getEdgeColor(selectedEdge);

        // Change the edge color to red to indicate selection
        setEdgeColor(selectedEdge, new BABYLON.Color3(1, 0, 0));  // Red color

        // Confirm deletion dialog
        let confirmDelete = confirm("Are you sure to delete this edge? Press T to view guide before deleting.");
        if (confirmDelete) {
            // Change the edge color to black if confirmed
            setEdgeColor(selectedEdge, new BABYLON.Color3(0, 0, 0));  // Black color

            // Save the node pairs
            if (findSavedEdgeIndex(nodePair) === -1) {
                savedEdges.push(nodePair);  // Store the node pair [fromNode, toNode]
            }
            console.log("Saved edge between nodes:", nodePair);
        } else {
            // Restore the original color (green) if not confirmed
            setEdgeColor(selectedEdge, originalColor);
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


// Adding this for the sake of tracking subject names
// let subjectName = "";  // Variable to store the subject name

let subjectName = "";  // Variable to store the subject name

function getSubjectNameFromFileName(fileName) {
    const graphGuideSuffix = "_graph+guide_data.json";
    if (fileName.endsWith(graphGuideSuffix)) {
        return fileName.slice(0, -graphGuideSuffix.length);
    }
    return fileName.replace(/\.json$/i, "");
}

function handleFileUpload(file) {
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);

            subjectName = getSubjectNameFromFileName(file.name);

            // Update the <h3> tag inside #labelListContainer with the subject name
            document.getElementById('subjectNameHeader').innerText = subjectName;

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
        savedEdges: savedEdges,  // Include the saved edges (node pairs)
        anatomicalDirections: anatomyDirectionAssignments
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
let guideMesh; // Declare a global variable to store the guide mesh


// function createGuide(meshData) {
//         // Extract vertices and faces from the JSON file
//         const vertices = meshData.vertices.flat(); // Flatten the vertices array
//         const faces = meshData.faces.flat();       // Flatten the faces array

//         // Create a new mesh in Babylon.js
//         const customMesh = new BABYLON.Mesh("custom", scene);
//         const vertexData = new BABYLON.VertexData();

//         vertexData.positions = vertices;
//         vertexData.indices = faces;

//         // Apply vertex data to the mesh
//         vertexData.applyToMesh(customMesh);

//         // Set material with transparency
//         const material = new BABYLON.StandardMaterial("material", scene);
//         material.alpha = 0.2; // Set transparency
//         material.diffuseColor = new BABYLON.Color3(0.8, 0.8, 0.8); // Green color for visibility
//         customMesh.material = material;

//         // Optionally scale and position the mesh
//         // customMesh.scaling = new BABYLON.Vector3(0.1, 0.1, 0.1);
//         customMesh.position = new BABYLON.Vector3(0, 0, 0);

//         // Render loop
//         // engine.runRenderLoop(function () {
//         //     scene.render();
//         // });
//     }

function createGuide(meshData) {
    // Extract vertices and faces from the JSON file
    const vertices = meshData.vertices.flat(); // Flatten the vertices array
    const faces = meshData.faces.flat();       // Flatten the faces array

    // Create a new mesh in Babylon.js
    guideMesh = new BABYLON.Mesh("guide", scene); // Store the mesh in the global variable
    const vertexData = new BABYLON.VertexData();

    vertexData.positions = vertices;
    vertexData.indices = faces;

    // Apply vertex data to the mesh
    vertexData.applyToMesh(guideMesh);
    guideMesh.isPickable = false;

    // Set material with transparency
    const material = new BABYLON.StandardMaterial("material", scene);
    material.alpha = 0.2; // Set transparency
    material.diffuseColor = new BABYLON.Color3(0.8, 0.8, 1); // Gray color for visibility
    guideMesh.material = material;

    // Optionally scale and position the mesh
    // guideMesh.scaling = new BABYLON.Vector3(0.1, 0.1, 0.1);
    guideMesh.position = new BABYLON.Vector3(0, 0, 0);
}

// Function to toggle the visibility of the guide
function toggleGuideVisibility() {
    if (guideMesh) {
        guideMesh.setEnabled(!guideMesh.isEnabled()); // Toggle visibility
    }
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
    if (orientationEngine) {
        orientationEngine.resize();
    }
});

// Initialize the scene and show the upload modal
initializeScene();
initializeOrientationWidget();
updateAllAnatomyDirectionButtons();
engine.runRenderLoop(() => {
    updateScreenFixedLighting();
    updateAnatomyDirectionVisibility();
    scene.render();
    renderOrientationWidget();
});

// Create a div for displaying shortcut instructions
const shortcutWindow = document.createElement('div');
shortcutWindow.style.position = 'fixed';
shortcutWindow.style.bottom = '20px';
shortcutWindow.style.left = '260px';
shortcutWindow.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
shortcutWindow.style.color = 'black';
shortcutWindow.style.padding = '10px';
shortcutWindow.style.borderRadius = '5px';
shortcutWindow.style.zIndex = '1000';
shortcutWindow.style.display = 'none';  // Initially hidden
shortcutWindow.innerHTML = `
    <h2>Keyboard Shortcuts</h2>
    <ul>
        <li><strong>R</strong>: Clear labels</li>
        <li><strong>Ctrl + S</strong>: Save labels</li>
        <li><strong>Home</strong>: Return to Z-facing home view</li>
        <li><strong>=</strong>: Increase node size</li>
        <li><strong>-</strong>: Decrease node size</li>
        <li><strong>H</strong>: Toggle label visibility</li>
        <li><strong>L</strong>: Suggest unused label</li>
        <li><strong>G</strong>: Toggle guide visibility</li>
        <li><strong>TAB</strong>: Show this shortcut list</li>
    </ul>
`;
document.body.appendChild(shortcutWindow);  // Add it to the document body

// Flag to track Tab key press
let tabPressed = false;

// Single event listener for all keyboard shortcuts
window.addEventListener('keydown', (event) => {
    // if (event.key === 'D' || event.key === 'd') {
    //     // Toggle the mode
    //     document.getElementById('modeButton').click();
    // } else 
    if (event.key === 'R' || event.key === 'r') {
        // Reset labels
        document.getElementById('resetButton').click();
    } else if (event.key === 's' && event.ctrlKey) {
        // Save labels with Ctrl+S
        event.preventDefault();  // Prevent browser's default save action
        document.getElementById('saveButton').click();
    } else if (event.key === 'Home') {
        event.preventDefault();
        document.getElementById('homeZButton').click();
    } else if (event.key === '=') {
        // Increase node size via slider
        nodeSizeSlider.value = Math.min(parseInt(nodeSizeSlider.value) + 1, 6);  // Increment and cap at 6
        nodeSizeSlider.dispatchEvent(new Event('input'));  // Trigger the input event
    } else if (event.key === '-') {
        // Decrease node size via slider
        nodeSizeSlider.value = Math.max(parseInt(nodeSizeSlider.value) - 1, 1);  // Decrement and cap at 1
        nodeSizeSlider.dispatchEvent(new Event('input'));  // Trigger the input event
    } else if (event.key === 'H' || event.key === 'h') {
        // Toggle label visibility
        toggleLabelVisibility();
    } else if (event.key === 'L' || event.key === 'l') {
        // Suggest unused label
        suggestUnusedLabel();
    } else if (event.key === 'g' || event.key === 'G') {
        // Toggle guide visibility
        toggleGuideVisibility();
    } else if (event.key === 'Tab') {
        // Show the shortcut list when Tab is pressed
        if (!tabPressed) {
            tabPressed = true;
            event.preventDefault();  // Prevent default Tab behavior
            shortcutWindow.style.display = 'block';  // Show the shortcut list
        }
    }
});

// Event listener to hide the shortcut list when Tab is released
window.addEventListener('keyup', (event) => {
    if (event.key === 'Tab') {
        tabPressed = false;
        shortcutWindow.style.display = 'none';  // Hide the shortcut list
    }
});


//Old handling of shortcuts
// // Keyboard Shortcuts for D (toggle mode), R (reset), Ctrl+S (save), = (increase node size), and - (decrease node size)
// window.addEventListener('keydown', (event) => {
//     if (event.key === 'D' || event.key === 'd') {
//         // Toggle the mode
//         document.getElementById('modeButton').click();
//     } else if (event.key === 'R' || event.key === 'r') {
//         // Reset labels
//         document.getElementById('resetButton').click();
//     } else if (event.key === 's' && event.ctrlKey) {
//         // Save labels with Ctrl+S
//         event.preventDefault();  // Prevent browser's default save action
//         document.getElementById('saveButton').click();
//     } else if (event.key === '=') {
//         // Increase node size via slider
//         nodeSizeSlider.value = Math.min(parseInt(nodeSizeSlider.value) + 1, 6);  // Increment and cap at 6
//         nodeSizeSlider.dispatchEvent(new Event('input'));  // Trigger the input event
//     } else if (event.key === '-') {
//         // Decrease node size via slider
//         nodeSizeSlider.value = Math.max(parseInt(nodeSizeSlider.value) - 1, 1);  // Decrement and cap at 1
//         nodeSizeSlider.dispatchEvent(new Event('input'));  // Trigger the input event
//     }
// });
// // Add event listener for "H" or "h" key to toggle label visibility
// window.addEventListener('keydown', (event) => {
//     if (event.key === 'H' || event.key === 'h') {
//         toggleLabelVisibility();  // Call the toggle function when "H" is pressed
//     }
// });

// // Add event listener for the "L" or "l" shortcut key
// window.addEventListener('keydown', (event) => {
//     if (event.key === 'L' || event.key === 'l') {
//         suggestUnusedLabel();  // Call suggestion function
//     }
// });

// // Add event listener to detect 'g' or 'G' key press
// window.addEventListener('keydown', function(event) {
//     if (event.key === 'g' || event.key === 'G') {
//         toggleGuideVisibility();
//     }
// });
